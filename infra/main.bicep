param location string = resourceGroup().location
param name string

var storageName = toLower(replace(name, '-', ''))

resource stg 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
}

resource contIncoming 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${stg.name}/default/incoming'
}
resource contQuarantine 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${stg.name}/default/quarantine'
}
resource contAnalysis 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${stg.name}/default/analysis'
}

resource sb 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: '${name}-sb'
  location: location
  sku: { name: 'Standard', tier: 'Standard' }
}
resource qScan 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  name: '${sb.name}/ingest.scan'
}
resource qAnalyze 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  name: '${sb.name}/ingest.analyze'
}

resource ai 'Microsoft.Insights/components@2020-02-02' = {
  name: '${name}-ai'
  location: location
  kind: 'web'
  properties: { Application_Type: 'web' }
}

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${name}-kv'
  location: location
  properties: {
    enablePurgeProtection: true
    enableSoftDelete: true
    sku: { name: 'standard', family: 'A' }
    tenantId: subscription().tenantId
    accessPolicies: []
  }
}

resource eg 'Microsoft.EventGrid/topics@2022-06-15' = {
  name: '${name}-eg-topic'
  location: location
}

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: '${name}-cosmos'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [ { locationName: location } ]
  }
}
