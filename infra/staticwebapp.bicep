param location string = resourceGroup().location
param name string
param repoUrl string
param branch string = 'main'

// Azure Static Web Apps with Functions backend
resource swa 'Microsoft.Web/staticSites@2022-03-01' = {
  name: name
  location: location
  sku: { name: 'Standard' }
  properties: {
    repositoryUrl: repoUrl
    branch: branch
    buildProperties: {
      appLocation: 'apps/client'
      apiLocation: 'apps/api-csharp/src'
      appBuildCommand: 'pnpm i --frozen-lockfile && pnpm -r build'
      outputLocation: 'dist'
      apiBuildCommand: 'dotnet build -c Release'
    }
  }
}
