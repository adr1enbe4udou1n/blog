---
title: "Setup a HA Kubernetes cluster Part IX - Code metrics with SonarQube & load testing"
date: 2023-10-09
description: "Follow this opinionated guide as starter-kit for your own Kubernetes platform..."
tags: ["kubernetes", "testing", "sonarqube", "load-testing", "k6"]
draft: true
---

{{< lead >}}
Be free from AWS/Azure/GCP by building a production grade On-Premise Kubernetes cluster on cheap VPS provider, fully GitOps managed, and with complete CI/CD tools 🎉
{{< /lead >}}

This is the **Part IX** of more global topic tutorial. [Back to first part]({{< ref "/posts/10-build-your-own-kubernetes-cluster" >}}) for intro.

## Code Metrics

SonarQube is leading the code metrics industry for a long time, embracing full Open Core model, and the community edition it's completely free of charge even for commercial use. It covers advanced code analysis, code coverage, code duplication, code smells, security vulnerabilities, etc. It ensures high quality code and help to keep it that way.

### SonarQube installation

SonarQube as its dedicated Helm chart which perfect for us. However, it's the most resource hungry component of our development stack so far (because Java project ? End of troll), so be sure to deploy it on almost empty free node, maybe a dedicated one. In fact, it's the last Helm chart for this tutorial, I promise!

Create dedicated database for SonarQube same as usual.

{{< highlight host="demo-kube-k3s" file="main.tf" >}}

```tf
variable "sonarqube_db_password" {
  type      = string
  sensitive = true
}
```

{{< /highlight >}}

{{< highlight host="demo-kube-k3s" file="terraform.tfvars" >}}

```tf
sonarqube_db_password = "xxx"
```

{{< /highlight >}}

{{< highlight host="demo-kube-k3s" file="sonarqube.tf" >}}

```tf
resource "kubernetes_namespace_v1" "sonarqube" {
  metadata {
    name = "sonarqube"
  }
}

resource "helm_release" "sonarqube" {
  chart      = "sonarqube"
  version    = "10.1.0+628"
  repository = "https://SonarSource.github.io/helm-chart-sonarqube"

  name      = "sonarqube"
  namespace = kubernetes_namespace_v1.sonarqube.metadata[0].name

  set {
    name  = "prometheusMonitoring.podMonitor.enabled"
    value = "true"
  }

  set {
    name  = "postgresql.enabled"
    value = "false"
  }

  set {
    name  = "jdbcOverwrite.enabled"
    value = "true"
  }

  set {
    name  = "jdbcOverwrite.jdbcUrl"
    value = "jdbc:postgresql://postgresql-primary.postgres/sonarqube"
  }

  set {
    name  = "jdbcOverwrite.jdbcUsername"
    value = "sonarqube"
  }

  set {
    name  = "jdbcOverwrite.jdbcPassword"
    value = var.sonarqube_db_password
  }
}

resource "kubernetes_manifest" "sonarqube_ingress" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "IngressRoute"
    metadata = {
      name      = "sonarqube"
      namespace = kubernetes_namespace_v1.sonarqube.metadata[0].name
    }
    spec = {
      entryPoints = ["websecure"]
      routes = [
        {
          match = "Host(`sonarqube.${var.domain}`)"
          kind  = "Rule"
          services = [
            {
              name = "sonarqube-sonarqube"
              port = "http"
            }
          ]
        }
      ]
    }
  }
}
```

{{< /highlight >}}

Be sure to disable the PostgreSQL sub chart and use our self-hosted cluster with both `postgresql.enabled` and `jdbcOverwrite.enabled`. If needed, set proper `tolerations` and `nodeSelector` for deploying on a dedicated node.

The installation take many minutes, be patient. Once done, you can access SonarQube on `https://sonarqube.kube.rocks` and login with `admin` / `admin`.

### Project configuration

Firstly create a new project and retain the project key which is his identifier. Then create a **global analysis token** named `Concourse CI` that will be used for CI integration from your user account under `/account/security`.

Now we need to create a Kubernetes secret which contains this token value for Concourse CI, for usage inside the pipeline. The token is the one generated above.

Add a new concourse terraform variable for the token:

{{< highlight host="demo-kube-k3s" file="main.tf" >}}

```tf
variable "concourse_analysis_token" {
  type      = string
  sensitive = true
}
```

{{< /highlight >}}

{{< highlight host="demo-kube-k3s" file="terraform.tfvars" >}}

```tf
concourse_analysis_token = "xxx"
```

{{< /highlight >}}

The secret:

{{< highlight host="demo-kube-k3s" file="concourse.tf" >}}

```tf
resource "kubernetes_secret_v1" "concourse_sonarqube" {
  metadata {
    name      = "sonarqube"
    namespace = "concourse-main"
  }

  data = {
    url            = "https://sonarqube.${var.domain}"
    analysis-token = var.concourse_analysis_token
  }

  depends_on = [
    helm_release.concourse
  ]
}
```

{{< /highlight >}}

We are ready to tackle the pipeline for integration.

### SonarScanner for .NET

As we use a dotnet project, we will use the official SonarQube scanner for .net. But sadly, as it's only a .NET CLI wrapper, it requires a java runtime to run and there is no official SonarQube docker image which contains both .NET SDK and Java runtime. But we have a CI now, so we can build our own QA image on our own private registry.

Create a new Gitea repo dedicated for any custom docker images with this one single Dockerfile:

{{< highlight host="demo-kube-images" file="dotnet-qa.dockerfile" >}}

```Dockerfile
FROM mcr.microsoft.com/dotnet/sdk:7.0

RUN apt-get update && apt-get install -y ca-certificates-java && apt-get install -y \
    openjdk-17-jre-headless \
    unzip \
    && rm -rf /var/lib/apt/lists/*

RUN dotnet tool install --global dotnet-sonarscanner
RUN dotnet tool install --global dotnet-coverage

ENV PATH="${PATH}:/root/.dotnet/tools"
```

{{< /highlight >}}

Note as we add the `dotnet-sonarscanner` tool to the path, we can use it directly in the pipeline without any extra step. I'll also add `dotnet-coverage` global tool for code coverage generation that we'll use later.

Then the pipeline:

{{< highlight host="demo-kube-flux" file="pipelines/images.yaml" >}}

```yml
resources:
  - name: docker-images-git
    type: git
    icon: coffee
    source:
      uri: https://gitea.kube.rocks/kuberocks/docker-images
      branch: main
  - name: dotnet-qa-image
    type: registry-image
    icon: docker
    source:
      repository: ((registry.name))/kuberocks/dotnet-qa
      tag: "7.0"
      username: ((registry.username))
      password: ((registry.password))

jobs:
  - name: dotnet-qa
    plan:
      - get: docker-images-git
      - task: build-image
        privileged: true
        config:
          platform: linux
          image_resource:
            type: registry-image
            source:
              repository: concourse/oci-build-task
          inputs:
            - name: docker-images-git
          outputs:
            - name: image
          params:
            DOCKERFILE: docker-images-git/dotnet-qa.dockerfile
          run:
            path: build
      - put: dotnet-qa-image
        params:
          image: image/image.tar
```

{{< /highlight >}}

Update the `main.yaml` pipeline to add the new job, then trigger it manually from Concourse UI to add the new above pipeline:

{{< highlight host="demo-kube-flux" file="pipelines/main.yaml" >}}

```tf
#...

jobs:
  - name: configure-pipelines
    plan:
      #...
      - set_pipeline: images
        file: ci/pipelines/images.yaml
```

{{< /highlight >}}

The pipeline should now start and build the image, trigger it manually if needed on Concourse UI. Once done, you can check it on your Gitea container packages that the new image `gitea.kube.rocks/kuberocks/dotnet-qa` is here.

### Concourse pipeline integration

It's finally time to reuse this QA image in our Concourse demo project pipeline. Update it accordingly:

{{< highlight host="demo-kube-flux" file="pipelines/demo.yaml" >}}

```yml
#...

jobs:
  - name: build
    plan:
      - get: source-code
        trigger: true

      - task: build-source
        config:
          platform: linux
          image_resource:
            type: registry-image
            source:
              repository: ((registry.name))/kuberocks/dotnet-qa
              tag: "7.0"
              username: ((registry.username))
              password: ((registry.password))
          #...
          run:
            path: /bin/sh
            args:
              - -ec
              - |
                dotnet format --verify-no-changes

                dotnet sonarscanner begin /k:"KubeRocks-Demo" /d:sonar.host.url="((sonarqube.url))"  /d:sonar.token="((sonarqube.analysis-token))"
                dotnet build -c Release
                dotnet sonarscanner end /d:sonar.token="((sonarqube.analysis-token))"

                dotnet publish src/KubeRocks.WebApi -c Release -o publish --no-restore --no-build

      #...
```

{{< /highlight >}}

Note as we now use the `dotnet-qa` image and surround the build step by `dotnet sonarscanner begin` and `dotnet sonarscanner end` commands with appropriate credentials allowing Sonar CLI to send report to our SonarQube instance.

## Unit & integration Testing

### xUnit

### Code Coverage

## Load testing

### K6

### Load balancing database

## Final check 🎊🏁🎊

Congratulation if you're getting that far !!!

You have a complete CI/CD flexible solution, HA ready and not that expensive.
