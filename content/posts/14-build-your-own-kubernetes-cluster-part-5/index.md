---
title: "Setup a HA Kubernetes cluster Part V - CD with Flux"
date: 2023-10-05
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "postgresql", "longhorn"]
draft: true
---

{{< lead >}}
Be free from AWS/Azure/GCP by building a production grade On-Premise Kubernetes cluster on cheap VPS provider, fully GitOps managed, and with complete CI/CD tools 🎉
{{< /lead >}}

This is the **Part V** of more global topic tutorial. [Back to first part]({{< ref "/posts/10-build-your-own-kubernetes-cluster" >}}) for intro.

## Flux

In GitOps world, 2 tools are in lead for CD in k8s : Flux and ArgoCD. As Flux is CLI first and more lightweight, it's my personal goto. You may ask why don't continue with actual k8s Terraform project ?

You already noted that by adding more and more Helm dependencies to terraform, the plan time is increasing, as well as the state file. So not very scalable.

It's the perfect moment to draw a clear line between **IaC** and **CD**. IaC is for infrastructure, CD is for application. So to resume our GitOps stack :

1. IaC for Hcloud cluster initialization (*the basement*) : **Terraform**
2. IaC for cluster configuration (*the walls*) : **Helm** through **Terraform**
3. CD for application deployment (*the furniture*) : **Flux**

{{< alert >}}
You can probably eliminate with some efforts the 2nd stack by using both `Kube-Hetzner`, which take care of ingress and storage, and using Flux directly for the remaining helms like database cluster. Or maybe you can also add custom helms to `Kube-Hetzner` ?  
But as it's increase complexity and dependencies problem, I prefer personally to keep a clear separation between the middle part and the rest, as it's more straightforward for me. Just a matter of taste 🥮
{{< /alert >}}

### Flux bootstrap

Create a dedicated Git repository for Flux somewhere, I'm using Github, which is just a matter of:

```sh
gh repo create demo-kube-flux --private --add-readme
gh repo clone demo-kube-flux
```

{{< alert >}}
Put `--add-readme` option to have a non-empty repo, otherwise Flux bootstrap will give you an error.
{{< /alert >}}

Let's back to `demo-kube-k3s` terraform project and add Flux bootstrap connected to above repository:

{{< highlight host="demo-kube-k3s" file="main.tf" >}}

```tf
terraform {
  //...

  required_providers {
    flux = {
      source = "fluxcd/flux"
    }
    github = {
      source = "integrations/github"
    }
  }
}

//...

variable "github_token" {
  sensitive = true
  type      = string
}

variable "github_org" {
  type = string
}

variable "github_repository" {
  type = string
}
```

{{< /highlight >}}

{{< highlight host="demo-kube-k3s" file="flux.tf" >}}

```tf
github_org           = "mykuberocks"
github_repository    = "demo-kube-flux"
github_token         = "xxx"
```

{{< /highlight >}}

{{< alert >}}
Create a [Github token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) with repo permissions and add it to `github_token` variable.
{{< /alert >}}

{{< highlight host="demo-kube-k3s" file="flux.tf" >}}

```tf
provider "github" {
  owner = var.github_org
  token = var.github_token
}

resource "tls_private_key" "flux" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

resource "github_repository_deploy_key" "this" {
  title      = "Flux"
  repository = var.github_repository
  key        = tls_private_key.flux.public_key_openssh
  read_only  = false
}

provider "flux" {
  kubernetes = {
    config_path = "~/.kube/config"
  }
  git = {
    url = "ssh://git@github.com/${var.github_org}/${var.github_repository}.git"
    ssh = {
      username    = "git"
      private_key = tls_private_key.flux.private_key_pem
    }
  }
}

resource "flux_bootstrap_git" "this" {
  path = "clusters/demo"

  components_extra = [
    "image-reflector-controller",
    "image-automation-controller"
  ]

  depends_on = [github_repository_deploy_key.this]
}
```

{{< /highlight >}}

Note as we'll use `components_extra` to add `image-reflector-controller` and `image-automation-controller` to Flux, as it will serve us later for new image tag detection.

After applying this, use `kg deploy -n flux-system` to check that Flux is correctly installed and running.

## PgAdmin

* Automatic deployment on commit

## Nocode tools

* Automatic deployment on commit

## 3rd check ✅

We have everything we need for app building with automatic deployment ! Go [next part]({{< ref "/posts/15-build-your-own-kubernetes-cluster-part-6" >}}) to add complete monitoring stack !
