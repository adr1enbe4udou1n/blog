---
title: "Setup a HA Kubernetes cluster Part V - CI/CD tools"
date: 2023-10-05
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "postgresql", "longhorn"]
draft: true
---

{{< lead >}}
Be free from AWS/Azure/GCP by building a production grade On-Premise Kubernetes cluster on cheap VPS provider, fully GitOps managed, and with complete CI/CD tools 🎉
{{< /lead >}}

This is the **Part V** of more global topic tutorial. [Back to first part]({{< ref "/posts/10-build-your-own-kubernetes-cluster" >}}) for intro.

Dev Only - skippable
Add runner-01

## Gitea

* Validate DB & redis access
* Enable SSH access
* First commit test with basic DotNet sample app

## Concourse CI

* Automatic build on commit
* Push to Gitea Container Registry

## Flux

* Automatic deployment on commit

## 3rd check ✅

We have everything we need for app building with automatic deployment ! Go [next part]({{< ref "/posts/15-build-your-own-kubernetes-cluster-part-6" >}}) to add complete monitoring stack !
