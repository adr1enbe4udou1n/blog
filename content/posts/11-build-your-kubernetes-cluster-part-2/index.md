---
title: "Setup a HA Kubernetes cluster Part II - Cluster initialization with Terraform"
date: 2023-06-09
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "terraform", "hetzner", "k3s", "gitops"]
draft: true
---

{{< lead >}}
Be free from AWS/Azure/GCP by building a production grade On-Premise Kubernetes cluster on cheap VPS provider, fully GitOps managed, and with complete CI/CD tools 🎉
{{< /lead >}}

This is the **Part II** of more global topic tutorial. [Back to first part]({{< ref "/posts/10-build-your-kubernetes-cluster" >}}) for intro.

## The boring part (prerequisites)

Before attack the next part of this guide, I'll assume you have hard prerequisites.

### External providers

* A valid domain name with access to a the DNS zone administration, I'll use [Cloudflare](https://www.cloudflare.com/)
* [Hetzner Cloud](https://www.hetzner.com/cloud) account
* Any S3 bucket for long-term storage (backups, logs), I'll use [Scaleway](https://www.scaleway.com/) for this guide, prepare next variables :
* Any working SMTP account for transactional emails

### Terraform variables

For better fluidity, here is the expected list of variables you'll need to prepare. Store them in a secured place.

| Variable          | Sample value                    | Note                                                                            |
| ----------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| `hcloud_token`    | xxx                             | Token of existing **empty** Hetzner Cloud project <sup>1</sup>                  |
| `domain_name`     | kube.rocks                      | Valid registred domain name                                                     |
| `acme_email`      | <me@kube.rocks>                 | Valid email for Let's Encrypt registration                                      |
| `dns_token`       | xxx                             | Token of your DNS provider in order to issue certificates <sup>2</sup>          |
| `ssh_public_key`  | ssh-ed25519 xxx <me@kube.rocks> | Your public SSH key for cluster OS access                                       |
| `whitelisted_ips` | [82.82.82.82]                   | List of dedicated public IPs allowed for cluster management access <sup>3</sup> |
| `s3_endpoint`     | s3.fr-par.scw.cloud             | Custom endpoint if not using AWS                                                |
| `s3_region`       | fr-par                          |                                                                                 |
| `s3_bucket`       | kuberocks                       |                                                                                 |
| `s3_access_key`   | xxx                             |                                                                                 |
| `s3_secret_key`   | xxx                             |                                                                                 |
| `smtp_host`       | smtp-relay.brevo.com            |                                                                                 |
| `smtp_port`       | 587                             |                                                                                 |
| `smtp_user`       | <me@kube.rocks>                 |                                                                                 |
| `smtp_password`   | xxx                             |                                                                                 |

<sup>1</sup> Check [this link](https://github.com/hetznercloud/cli#getting-started>) in order to generate a token  
<sup>2</sup> Check cert-manager documentation to generate the token for supporting DNS provider, [example for Cloudflare](https://cert-manager.io/docs/configuration/acme/dns01/cloudflare/#api-tokens)  
<sup>3</sup> If your ISP provider doesn't provide static IP, you may need to use a custom VPN, hopefully Hetzner provide a self-hostable [one-click solution](https://github.com/hetznercloud/apps/tree/main/apps/hetzner/wireguard).
For more enterprise grade solution check [Teleport](https://goteleport.com/), which is not covered by this guide. Whatever the solution is, it's essential to have at least one of them for obvious security reasons.

### Local tools

* Git and SSH client of course
* [Terraform](https://www.terraform.io/downloads.html) >= 1.5.0
* Hcloud CLI >= 1.35.0 already connected to an **empty** project <https://github.com/hetznercloud/cli#getting-started>
* Kubernetes CLI
* [Flux CLI](https://fluxcd.io/flux/cmd/) for CD
* [Fly CLI](https://github.com/concourse/concourse/releases/latest) for CI

## K3s cluster initialization with Terraform

Let's initialize basic cluster setup with 1 master associate to 3 workers nodes. For that we'll using the official [Hetzner Cloud provider](https://registry.terraform.io/providers/hetznercloud/hcloud) for Terraform.

However, write all terraform logic from scratch is a bit tedious, even more if including K3s initial setup, so a better approach is to use a dedicated module that will considerably reduce code boilerplate.

For that we have mainly 2 options :

* Using the strongest community driven module for Hetzner : [Kube Hetzner](https://registry.terraform.io/modules/kube-hetzner/kube-hetzner/hcloud/latest)
* Write our own reusable module or using my [existing start-kit module](https://registry.terraform.io/modules/okami101/k3s)

Here are the pros and cons of each module :

|                         | [Kube Hetzner](https://registry.terraform.io/modules/kube-hetzner/kube-hetzner/hcloud/latest)                                                                                      | [Okami101 K3s](https://registry.terraform.io/modules/okami101/k3s)                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Support**             | Strong community                                                                                                                                                                   | Just intended as a reusable starter-kit                                                                                                   |
| **Included helms**      | Traefik, Longhorn, Cert Manager, Kured                                                                                                                                             | None, just the K3s initial setup, which is preferable when manage helms dependencies on separated terraform project                       |
| **Hetzner integration** | Complete, use [Hcloud Controller](https://github.com/hetznercloud/hcloud-cloud-controller-manager) internally, allowing dynamic Load Balancing, autoscaling, cleaner node deletion | Basic, public Load Balancer is statically managed by the nodepool configuration, no autoscaling support                                   |
| **OS**                  | openSUSE MicroOS, optimized for container worloads                                                                                                                                 | Debian 12 or Ubuntu 22.04                                                                                                                 |
| **Initial setup**       | Require packer for initial Snapshot creation, and slower on node creation because Hetnzer don't support it natively                                                                | Just about ~2 minutes for all cluster setup                                                                                               |
| **Client support**      | POSIX-based OS only, require WSL on Windows                                                                                                                                        | All including Powershell                                                                                                                  |
| **Internal complexity** | Huge, you can't really put your head inside                                                                                                                                        | Very accessible, easy to extend and fork, better for learning                                                                             |
| **Upgrade**             | You may need to follow new versions regularly                                                                                                                                      | As a simple starter-kit, no need to support all community problems, so very few updates                                                   |
| **Quality**             | Use many hacks to satisfy all community needs, plenty of remote-exec and file provisioner which is not recommended by HashiCorp themselves                                         | Use standard **cloud-config** for initial provisioning, then **Salt** for cluster OS management                                           |
| **Security**            | Needs an SSH private key because of local provisioners, and SSH port opened to every node                                                                                          | Require only public SSH key, SSH port only opened for controllers, required SSH jump from a controller to access any internal worker node |
| **Reusability**         | Vendor locked to Hetzner Cloud                                                                                                                                                     | Easy to adapt for a different cloud provider as long as it supports **cloud-config** (as 99% of them)                                     |

So for resume, choose Kube Hetzner module if :

* You want to use an OS optimized for containers, but note as it takes more RAM usage than Debian-like distro (230 Mo VS 120Mo).
* Strong community support is important for you
* Need of [Hcloud Controller](https://github.com/hetznercloud/hcloud-cloud-controller-manager) functionalities from the ground up, giving support for **autoscaling** and **dynamic load balancing**

Choose the starter-kit module if :

* You want to use a more standard OS, as Debian or Ubuntu, which consume less RAM, managed by preinstalled Salt
* You prefer to start with a simplistic module, without internal hacks, giving you a better understanding of the cluster setup step-by-step and more moveable to another cloud provider
* Very quick to set up, as it doesn't require any packer image creation, and use cloud-config for initial setup
* Preferring manage additional helm dependencies on a separated terraform project

So for this guide, I'll use my own module, feel free to use the other one if you prefer.

## K3s configuration and usage

* Local SSH + Kube apiserver access to the cluster
* Usage of salt
* K3s S3 backup

## Automatic upgrades

* OS reboot
* K3s upgrade

## HTTP access

* Traefik + cert-manager
* DNS configuration
* Dashboard traefik access
* Middlewares IP and auth

## 1st check ✅

We now have a working cluster, let's install [a load balanced ingress controller for external access through SSL]({{< ref "/posts/12-build-your-kubernetes-cluster-part-3" >}}) and proper HA storage.
