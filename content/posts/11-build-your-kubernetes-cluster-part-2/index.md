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

## K3s cluster building with Terraform

It's finally time to Begin with 1 master and 3 workers node with LB...

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
