FROM alpine:3.17

ENV BASE_URL="https://get.helm.sh"
ENV HELM_VERSION=v3.11.1
ENV HELM_TAR_GZ="helm-${HELM_VERSION}-linux-amd64.tar.gz"
ENV XDG_DATA_HOME="/root/.helm/"
ENV XDG_CACHE_HOME="/root/.helm/"
ENV XDG_CONFIG_HOME="/root/.helm/"

RUN apk add --no-cache ca-certificates \
    curl nodejs && \
    curl -L ${BASE_URL}/${HELM_TAR_GZ} | tar xvz && \
    mv linux-amd64/helm /usr/bin/helm && \
    chmod +x /usr/bin/helm && \
    rm -rf linux-amd64

COPY . /usr/src/
ENTRYPOINT ["node", "/usr/src/index.js"]
