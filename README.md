# Helm Action

Deploys a helm chart using GitHub actions
## Parameters

### Inputs

Inputs below are additionally loaded from the payload of the deployment event
payload if the action was triggered by a deployment.

- `release`: Helm release name. (required)
- `namespace`: Kubernetes namespace name. (required)
- `chart`: Helm chart path.
- `version`: The version of the helm chart you want to deploy.
- `values`: Helm chart values, expected to be a YAML or JSON string.
- `dry-run`: Helm dry-run option.
- `value-files`: Additional value files to apply to the helm chart. Expects a
  JSON encoded array or a string.
- `secrets`: Secret variables to include in value file interpolation. Expects a
  JSON encoded map.
- `timeout`: specify a timeout for helm deployment
- `repository`: specify the URL for a helm repo to come from
- `atomic`: If true, upgrade process rolls back changes made in case of failed upgrade. Defaults to false.


#### Versions

- `helm`: v3.11.1

## Example

```yaml
# .github/workflows/helm.yml
name: Deploy
on: ['push']

jobs:
  deployment:
    runs-on: 'ubuntu-latest'
    steps:
    - uses: actions/checkout@v1
    - name: 'Deploy'
      uses: 'isovalent/helm-action@master'
      with:
        release: 'mysql'
        namespace: 'default'
        chart: 'mysql'
        repository: https://charts.bitnami.com/bitnami
        values: |
          fullnameOverride: mysql
        # You can also reference files by providing an array of filenames
        # value-files: >-
        #   [
        #     "values.yaml",
        #     "values.production.yaml"
        #   ]
```
