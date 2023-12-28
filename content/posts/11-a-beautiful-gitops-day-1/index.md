---
title: "A beautiful GitOps day I - Cluster initialization with Terraform and K3s"
date: 2023-08-19
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "terraform", "hetzner", "k3s", "gitops"]
---

{{< lead >}}
Use GitOps workflow for building a production grade on-premise Kubernetes cluster on cheap VPS provider, with complete CI/CD 🎉
{{< /lead >}}

This is the **Part I** of more global topic tutorial. [Back to guide summary]({{< ref "/posts/10-a-beautiful-gitops-day" >}}) for intro.

## The boring part (prerequisites)

Before attack the next part of this guide, I'll assume you have hard prerequisites.

### External providers

* A valid domain name with access to a the DNS zone administration, I'll use [Cloudflare](https://www.cloudflare.com/) and `kube.rocks` as sample domain
* [Hetzner Cloud](https://www.hetzner.com/cloud) account
* Any S3 bucket for long-term storage (backups, logs), I'll use [Scaleway](https://www.scaleway.com/) for this guide
* Any working SMTP account for transactional emails, not hardly required but maybe more handy

### Terraform variables

For better fluidity, here is the expected list of variables you'll need to prepare. Store them in a secured place.

| Variable          | Sample value                    | Note                                                                            |
| ----------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| `hcloud_token`    | xxx                             | Token of existing **empty** Hetzner Cloud project <sup>1</sup>                  |
| `domain_name`     | kube.rocks                      | Valid registred domain name                                                     |
| `acme_email`      | <me@kube.rocks>                 | Valid email for Let's Encrypt registration                                      |
| `dns_api_token`   | xxx                             | Token of your DNS provider for issuing certificates <sup>2</sup>                |
| `ssh_public_key`  | ssh-ed25519 xxx <me@kube.rocks> | Your public SSH key for cluster OS level access <sup>3</sup>                    |
| `whitelisted_ips` | [82.82.82.82]                   | List of dedicated public IPs allowed for cluster management access <sup>4</sup> |
| `s3_endpoint`     | s3.fr-par.scw.cloud             | Custom endpoint if not using AWS                                                |
| `s3_region`       | fr-par                          |                                                                                 |
| `s3_bucket`       | kuberocks                       |                                                                                 |
| `s3_access_key`   | xxx                             |                                                                                 |
| `s3_secret_key`   | xxx                             |                                                                                 |
| `smtp_host`       | smtp-relay.brevo.com            |                                                                                 |
| `smtp_port`       | 587                             |                                                                                 |
| `smtp_user`       | <me@kube.rocks>                 |                                                                                 |
| `smtp_password`   | xxx                             |                                                                                 |

<sup>1</sup> Check [this link](https://github.com/hetznercloud/cli#getting-started>) for generating a token  
<sup>2</sup> Check cert-manager documentation to generate the token for supporting DNS provider, [example for Cloudflare](https://cert-manager.io/docs/configuration/acme/dns01/cloudflare/#api-tokens)  
<sup>3</sup> Generate a new SSH key with `ssh-keygen -t ed25519 -C "me@kube.rocks"`  
<sup>4</sup> If your ISP doesn't provide static IP, you may need to use a custom VPN, hopefully Hetzner provide a self-hostable [one-click solution](https://github.com/hetznercloud/apps/tree/main/apps/hetzner/wireguard).
For more enterprise grade solution check [Teleport](https://goteleport.com/), which is not covered by this guide. Whatever the solution is, it's essential to have at least one of them for obvious security reasons.

### Local tools

* Git and SSH obviously
* [Terraform](https://www.terraform.io/downloads.html) >= 1.5.0
* Hcloud CLI >= 1.35.0 already connected to an **empty** project <https://github.com/hetznercloud/cli#getting-started>
* Kubernetes CLI
* [Flux CLI](https://fluxcd.io/flux/cmd/) for CD
* [Fly CLI](https://github.com/concourse/concourse/releases/latest) for CI

## Cluster initialization using Terraform

For that we'll using the official [Hetzner Cloud provider](https://registry.terraform.io/providers/hetznercloud/hcloud) for Terraform.

However, writing all terraform logic from scratch is a bit tedious, even more if including K3s initial setup, so a better approach is to use a dedicated module that will considerably reduce code boilerplate.

### Choosing K3s Terraform module

We have mainly 2 options:

* Using the strongest community driven module for Hetzner: [Kube Hetzner](https://registry.terraform.io/modules/kube-hetzner/kube-hetzner/hcloud/latest)
* Write our own reusable module or using my [existing start-kit module](https://registry.terraform.io/modules/okami101/k3s)

Here are the pros and cons of each module:

|                         | [Kube Hetzner](https://registry.terraform.io/modules/kube-hetzner/kube-hetzner/hcloud/latest)                                                                                      | [Okami101 K3s](https://registry.terraform.io/modules/okami101/k3s)                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Support**             | Strong community                                                                                                                                                                   | Just intended as a reusable starter-kit                                                                                                                    |
| **CNI support**         | Choice between Flannel, Cilium, Calico                                                                                                                                             | Flannel only, while supporting network encryption with `enable_wireguard` variable, set `flannel-backend` to `none` if installing other CNI                |
| **Included helms**      | Traefik, Longhorn, Cert Manager, Kured                                                                                                                                             | None, just the K3s initial setup, as it's generally preferable to manage this helms dependencies on separated terraform project, allowing easier upgrading |
| **Hetzner integration** | Complete, use [Hcloud Controller](https://github.com/hetznercloud/hcloud-cloud-controller-manager) internally, allowing dynamic Load Balancing, autoscaling, cleaner node deletion | Basic, public Load Balancer is statically managed by the nodepool configuration, no autoscaling support                                                    |
| **OS**                  | openSUSE MicroOS, optimized for container worloads                                                                                                                                 | Debian 11 or Ubuntu 22.04                                                                                                                                  |
| **Initial setup**       | Require packer for initial Snapshot creation, and slower on node creation                                                                                                          | Just about ~1 minute for complete cluster creation, 1 more for initialization setup                                                                        |
| **Client support**      | POSIX-based OS only, require WSL on Windows                                                                                                                                        | All including Powershell                                                                                                                                   |
| **Internal complexity** | Huge, you can't really put your head inside                                                                                                                                        | Very accessible, easy to extend and fork, better for learning                                                                                              |
| **Upgrade**             | You may need to follow new versions regularly                                                                                                                                      | As a simple starter-kit, no need to support all community problems, so very few updates                                                                    |
| **Quality**             | Use many hacks to satisfy all community needs, plenty of remote-exec and file provisioner which is not recommended by HashiCorp themselves                                         | Use standard **cloud-config** for initial provisioning, then **Salt** for cluster OS management                                                            |
| **Security**            | Needs an SSH private key because of local provisioners, and SSH port opened to every node                                                                                          | Require only public SSH key, minimized opened SSH ports to only controllers, use SSH jump from a controller to access any internal worker node             |
| **Bastion**             | No real bastion support                                                                                                                                                            | Dedicated bastion host support with preinstalled WireGuard VPN, ideal for internal access to critical services like Kube API, longhorn, etc.               |
| **Reusability**         | Vendor locked to Hetzner Cloud                                                                                                                                                     | Easy to adapt for a different cloud provider as long as it supports **cloud-config** (as 99% of them)                                                      |

So for resume, choose Kube Hetzner module if:

* You want to use an OS optimized for containers, but note as it takes more RAM usage than Debian-like distro (230 Mo VS 120Mo).
* Strong community support is important for you
* Need of [Hcloud Controller](https://github.com/hetznercloud/hcloud-cloud-controller-manager) functionalities from the ground up, giving support for **autoscaling** and **dynamic load balancing**

Choose the starter-kit module if:

* You want to use a more standard OS, as Debian or Ubuntu, which consume less RAM, managed by preinstalled Salt
* You prefer to start with a simplistic module, without internal hacks, giving you a better understanding of the cluster setup step-by-step and more moveable to another cloud provider
* Very quick to set up, as it doesn't require any packer image creation, and use cloud-config for initial setup, without any client OS dependencies
* Preferring manage additional helm dependencies on a separated terraform project

For this guide, I'll consider using the starter kit as it's more suited for tutorials and allow better understanding of all steps of cluster creation process. You'll can more easily switch to the Kube Hetzner version later.

### 1st Terraform project

Let's initialize basic cluster setup. Create an empty folder (I name it `demo-kube-hcloud` here) for our terraform project, and create following `kube.tf` file:

{{< highlight host="demo-kube-hcloud" file="kube.tf" >}}

```tf
terraform {
  required_providers {
    hcloud = {
      source = "hetznercloud/hcloud"
    }
  }

  backend "local" {}
}

variable "hcloud_token" {
  type      = string
  sensitive = true
}

variable "my_public_ssh_keys" {
  type      = list(string)
  sensitive = true
}

variable "my_ip_addresses" {
  type      = list(string)
  sensitive = true
}

variable "s3_access_key" {
  type      = string
  sensitive = true
}

variable "s3_secret_key" {
  type      = string
  sensitive = true
}

provider "hcloud" {
  token = var.hcloud_token
}

module "hcloud_kube" {
  providers = {
    hcloud = hcloud
  }

  source = "okami101/k3s/hcloud"

  server_image    = "ubuntu-22.04"
  server_timezone = "Europe/Paris"
  server_locale   = "fr_FR.UTF-8"
  server_packages = ["nfs-common"]

  ssh_port = 2222

  cluster_name = "kube"
  cluster_user = "rocks"

  my_public_ssh_keys = var.my_public_ssh_keys
  my_ip_addresses    = var.my_ip_addresses

  k3s_channel = "stable"

  kubelet_args = [
    "eviction-hard=memory.available<250Mi"
  ]

  control_planes_custom_config = {
    tls-sans                    = ["cp.kube.rocks"]
    disable                     = ["traefik"]
    etcd-s3                     = true
    etcd-s3-endpoint            = "s3.fr-par.scw.cloud"
    etcd-s3-access-key          = var.s3_access_key
    etcd-s3-secret-key          = var.s3_secret_key
    etcd-s3-region              = "fr-par"
    etcd-s3-bucket              = "mykuberocks"
    etcd-snapshot-schedule-cron = "0 0 * * *"
  }

  control_planes = {
    server_type       = "cx21"
    location          = "nbg1"
    count             = 1
    private_interface = "ens10"
    labels            = []
    taints = [
      "node-role.kubernetes.io/control-plane:NoSchedule"
    ]
  }

  agent_nodepools = [
    {
      name              = "worker"
      server_type       = "cx21"
      location          = "nbg1"
      count             = 1
      private_interface = "ens10"
      labels            = []
      taints            = []
    }
  ]
}

output "ssh_config" {
  value = module.hcloud_kube.ssh_config
}
```

{{< /highlight >}}

#### Explanation

Get a complete description of the above file [here](https://github.com/okami101/terraform-hcloud-k3s/blob/main/kube.tf.example).

{{< tabs >}}
{{< tab tabName="State" >}}

```tf
backend "local" {}
```

I'm using a local backend for simplicity, but for teams sharing, you may use more appropriate backend, like S3 or Terraform Cloud (the most secured with encryption at REST, versioning and centralized locking).

Treat the Terraform state very carefully in secured place, as it's the only source of truth for your cluster. If leaked, consider the cluster as **compromised and you should active DRP (disaster recovery plan)**. The first vital action is at least to renew the Hetzner Cloud and S3 tokens immediately.

At any case, consider any leak of writeable Hetzner Cloud token as a **Game Over**. Indeed, even if the attacker has no direct access to existing servers, mainly because cluster SSH private key as well as kube config are not stored into Terraform state, he still has full control of infrastructure, and can do the following actions:

1. Create new server to same cluster network with its own SSH access.
2. Install a new K3s agent and connect it to the controllers thanks to the generated K3s token stored into Terraform state.
3. Sniff any data from the cluster that comes to the compromised server, including secrets, thanks to the new agent.
4. Get access to remote S3 backups.

In order to mitigate any risk of critical data leak, you may use data encryption whenever is possible. K3s offer it natively [for etcd](https://docs.k3s.io/security/secrets-encryption) and [for networking using WireGuard flannel option](https://docs.k3s.io/installation/network-options). Longhorn also offer it [natively for volumes](https://longhorn.io/docs/latest/advanced-resources/security/volume-encryption/) (including backups).

{{</ tab >}}
{{< tab tabName="Global" >}}

```tf
server_image    = "ubuntu-22.04"
server_timezone = "Europe/Paris"
server_locale   = "fr_FR.UTF-8"
server_packages = ["nfs-common"]

ssh_port = 2222

cluster_name = "kube"
cluster_user = "rocks"

my_public_ssh_keys = var.my_public_ssh_keys
my_ip_addresses    = var.my_ip_addresses
```

Choose between `ubuntu-22.04` or `debian-11`, and set the timezone, locale and the default packages you want to install on initial node provisioning. Once server created you may use Salt for changing them globally in the cluster.

Why not `debian-12` ? Because it's sadly not yet supported by [Salt project](https://github.com/saltstack/salt/issues/64223)...

{{< alert >}}
`nfs-common` package is required for Longhorn in order to support RWX volumes.
{{< /alert >}}

`cluster_name` is the node's name prefix and will have the format `{cluster_name}-{pool_name}-{index}`, for example `kube-storage-01`. `cluster_user` is the username UID 1000 for SSH access with sudo rights. `root` user is disabled for remote access security reasons.

{{</ tab >}}
{{< tab tabName="K3s" >}}

```tf
k3s_channel = "stable"

kubelet_args = [
  "eviction-hard=memory.available<250Mi"
]
```

This is the K3s specific configuration, where you can choose the channel (stable or latest), and the kubelet arguments.

I also prefer increase the eviction threshold to 250Mi, in order to avoid OS OOM killer.

{{</ tab >}}
{{< tab tabName="Backup" >}}

```tf
control_planes_custom_config = {
  tls-sans                    = ["cp.kube.rocks"]
  disable                     = ["traefik"]
  etcd-s3                     = true
  etcd-s3-endpoint            = "s3.fr-par.scw.cloud"
  etcd-s3-access-key          = var.s3_access_key
  etcd-s3-secret-key          = var.s3_secret_key
  etcd-s3-region              = "fr-par"
  etcd-s3-bucket              = "mykuberocks"
  etcd-snapshot-schedule-cron = "0 0 * * *"
}
```

Here some specific additional configuration for k3s servers.

I'm disabling included Traefik because we'll use a more flexible official Helm later.

We're adding automatic daily backup of etcd database on S3 bucket, which is useful for faster disaster recovery. See the official guide [here](https://docs.k3s.io/datastore/backup-restore).

{{</ tab >}}
{{< tab tabName="Cluster" >}}

```tf
control_planes = {
  server_type       = "cx21"
  location          = "nbg1"
  count             = 1
  private_interface = "ens10"
  labels            = []
  taints = [
    "node-role.kubernetes.io/control-plane:NoSchedule"
  ]
}

agent_nodepools = [
  {
    name              = "worker"
    server_type       = "cx21"
    location          = "nbg1"
    count             = 1
    private_interface = "ens10"
    labels            = []
    taints            = []
  }
]
```

This is the heart configuration of the cluster, where you can define the number of control planes and workers nodes, their type, and their network interface. We'll use 1 master and 1 worker to begin with.

The interface `ens10` is proper for intel CPU, use `enp7s0` for AMD.

Use the taint `node-role.kubernetes.io/control-plane:NoSchedule` in order to prevent any workload to be scheduled on the control plane.

{{</ tab >}}
{{< tab tabName="SSH" >}}

```tf
output "ssh_config" {
  value = module.hcloud_k3s.ssh_config
}
```

Will print the SSH config access after cluster creation.

{{</ tab >}}
{{</ tabs >}}

#### ETCD and network encryption by default

You may need to enable etcd and network encryption in order to prevent any data leak in case of a server is compromised. You can easily do so by adding the following variables:

{{< highlight host="demo-kube-hcloud" file="kube.tf" >}}

```tf
module "hcloud_kube" {
  //...
  # You need to install WireGuard package on all nodes
  server_packages = ["wireguard"]

  control_planes_custom_config = {
    //...
    flannel-backend    = "wireguard-native"
    secrets-encryption = true,
  }

  //...
}
```

{{< /highlight >}}

You can check the ETCD encryption status with `sudo k3s secrets-encrypt status`:

```txt
Encryption Status: Enabled
Current Rotation Stage: start
Server Encryption Hashes: All hashes match

Active  Key Type  Name
------  --------  ----
 *      AES-CBC   aescbckey
```

#### Inputs

As input variables, you have the choice to use environment variables or separated `terraform.tfvars` file.

{{< tabs >}}
{{< tab tabName="terraform.tfvars file" >}}

{{< highlight host="demo-kube-hcloud" file="terraform.tfvars" >}}

```tf
hcloud_token = "xxx"
my_ip_addresses = [
  "82.82.82.82/32"
]
my_public_ssh_keys = [
  "ssh-ed25519 xxx"
]
s3_access_key = "xxx"
s3_secret_key = "xxx"
```

{{< /highlight >}}

{{</ tab >}}
{{< tab tabName="Environment variables" >}}

```sh
export TF_VAR_hcloud_token="xxx"
export TF_VAR_my_public_ssh_keys='["xxx"]'
export TF_VAR_my_ip_addresses='["ssh-ed25519 xxx me@kube.rocks"]'
export TF_VAR_s3_access_key="xxx"
export TF_VAR_s3_secret_key="xxx"
```

{{</ tab >}}
{{</ tabs >}}

#### Terraform apply

It's finally time to initialize the cluster:

```sh
terraform init
terraform apply
```

Check the printed plan and confirm. The cluster creation will take about 1 minute. When finished following SSH configuration should appear:

```sh
Host kube
    HostName xxx.xxx.xxx.xxx
    User rocks
    Port 2222

Host kube-controller-01
    HostName 10.0.0.2
    HostKeyAlias kube-controller-01
    User rocks
    Port 2222
    ProxyJump kube

Host kube-worker-01
    HostName 10.0.1.1
    HostKeyAlias kube-worker-01
    User rocks
    Port 2222
    ProxyJump kube
```

#### Git-able project

As we are GitOps, you'll need to version the Terraform project. With a proper gitignore generator tool like [gitignore.io](https://docs.gitignore.io/install/command-line) It's just a matter of:

```sh
git init
gig terraform
```

And the project is ready to be pushed to any Git repository.

#### Cluster access

Merge above SSH config into your `~/.ssh/config` file, then test the connection with `ssh kube`.

{{< alert >}}
If you get "Connection refused", it's probably because the server is still on cloud-init phase. Wait a few minutes and try again. Be sure to have the same public IPs as the one you whitelisted in the Terraform variables. You can edit them and reapply the Terraform configuration at any moment.
{{< /alert >}}

Before using K3s, let's enable Salt for OS management by taping `sudo salt-key -A -y`. This will accept all pending keys, and allow Salt to connect to all nodes. To upgrade all nodes at one, just type `sudo salt '*' pkg.upgrade`.

In order to access the 1st worker node, you only have to use `ssh kube-worker-01`.

### K3s access and usage

It's time to log in to K3s and check the cluster status from local.

From the controller, copy `/etc/rancher/k3s/k3s.yaml` on your machine located outside the cluster as `~/.kube/config`. Then replace the value of the server field with the IP or name of your K3s server. `kubectl` can now manage your K3s cluster.

{{< alert >}}
If `~/.kube/config` already existing, you have to properly [merging the config inside it](https://able8.medium.com/how-to-merge-multiple-kubeconfig-files-into-one-36fc987c2e2f). You can use `kubectl config view --flatten` for that.  
Then use `kubectl config use-context kube` for switching to your new cluster.
{{< /alert >}}

Type `kubectl get nodes` and you should see the 2 nodes of your cluster in **Ready** state.

```txt
NAME                 STATUS   ROLES                       AGE    VERSION
kube-controller-01   Ready    control-plane,etcd,master   153m   v1.27.4+k3s1
kube-worker-01       Ready    <none>                      152m   v1.27.4+k3s1
```

#### Kubectl Aliases

As we'll use `kubectl` a lot, I highly encourage you to use aliases for better productivity:

* <https://github.com/ahmetb/kubectl-aliases> for bash
* <https://github.com/shanoor/kubectl-aliases-powershell> for Powershell

After the install the equivalent of `kubectl get nodes` is `kgno`.

#### Test adding new workers

Now, adding new workers is as simple as increment the `count` value of the worker nodepool 🚀

{{< highlight file="kube.tf" >}}

```tf
agent_nodepools = [
  {
    name = "worker"
    // ...
    count = 3
    // ...
  }
]
```

{{< /highlight >}}

Then apply the Terraform configuration again. After few minutes, you should see 2 new nodes in **Ready** state.

```txt
NAME                 STATUS   ROLES                       AGE    VERSION
kube-controller-01   Ready    control-plane,etcd,master   166m   v1.27.4+k3s1
kube-worker-01       Ready    <none>                      165m   v1.27.4+k3s1
kube-worker-02       Ready    <none>                      42s    v1.27.4+k3s1
kube-worker-03       Ready    <none>                      25s    v1.27.4+k3s1
```

{{< alert >}}
You'll have to use `sudo salt-key -A -y` each time you'll add a new node to the cluster for global OS management.
{{< /alert >}}

#### Deleting workers

Simply decrement the `count` value of the worker nodepool, and apply the Terraform configuration again. After few minutes, you should see the node in **NotReady** state.

To finalize the deletion, delete the node from the cluster with `krm no kube-worker-03`.

{{< alert >}}
If node have some workloads running, you'll have to consider a proper [draining](https://kubernetes.io/docs/tasks/administer-cluster/safely-drain-node/) before deleting it.
{{< /alert >}}

## 1st check ✅

We now have a working cluster, fully GitOps managed, easy to scale up, let's install [a load balanced ingress controller for external access through SSL]({{< ref "/posts/12-a-beautiful-gitops-day-2" >}}).
