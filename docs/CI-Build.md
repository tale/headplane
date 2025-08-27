# CI build

## Gitlab

To build heaplane using a Gitlab docker runner.

###### .gitlab-ci.yml

```yaml
stages:
  - build

variables:
  VERSION: "v0.6.0"
  GIT_SUBMODULE_STRATEGY: recursive
  NODE_ENV: production
  GITHUB_REPO: "https://github.com/tale/headplane.git"
  TEMP_DIR: "/tmp/headplane"

build:
  stage: build
  image: node:22-alpine
  before_script:
    - apk add git curl
    - npm install -g pnpm@10
  script:
    - git clone --branch main $GITHUB_REPO $TEMP_DIR
    - cd $TEMP_DIR
    - git checkout $VERSION
    - pnpm install --frozen-lockfile
    - pnpm run build
    - mkdir -p $CI_PROJECT_DIR/artifacts
    - tar -czf "$CI_PROJECT_DIR/artifacts/headplane-$VERSION.tar.gz" build
    - |
      curl --header "JOB-TOKEN: $CI_JOB_TOKEN" \
           --upload-file "$CI_PROJECT_DIR/artifacts/headplane-$VERSION.tar.gz" \
           "${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/generic/headplane/${VERSION}/headplane-$VERSION.tar.gz"


```

 