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

### Flux installation

Create a dedicated Git repository for Flux somewhere, I'm using Github, which is just a matter of:

```sh
gh repo create demo-kube-flux --private
gh repo clone demo-kube-flux
cd demo-kube-flux
```

## PgAdmin

* Automatic deployment on commit

## Nocode tools

* Automatic deployment on commit

## 3rd check ✅

We have everything we need for app building with automatic deployment ! Go [next part]({{< ref "/posts/15-build-your-own-kubernetes-cluster-part-6" >}}) to add complete monitoring stack !
