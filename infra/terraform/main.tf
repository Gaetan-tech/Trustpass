# Infrastructure Azure partagée TrustPass (cost-minimal).
# 1 cluster AKS (control plane Free) + 1 ACR Basic. Les 3 environnements
# (staging/preprod/prod) sont des NAMESPACES sur ce cluster, pas des clusters séparés.

# Suffixe aléatoire pour les noms globalement uniques (ACR).
resource "random_string" "suffix" {
  length  = 5
  special = false
  upper   = false
  numeric = true
}

# --- Resource Group -------------------------------------------------------
resource "azurerm_resource_group" "main" {
  name     = "${var.project}-rg-shared"
  location = var.location
  tags     = var.tags
}

# --- Container Registry (images backend/frontend) -------------------------
resource "azurerm_container_registry" "acr" {
  name                = "${var.project}acr${random_string.suffix.result}" # alphanum, unique
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = false # on privilégie l'identité managée (pas de mdp)
  tags                = var.tags
}

# --- Cluster AKS ----------------------------------------------------------
resource "azurerm_kubernetes_cluster" "aks" {
  name                = "${var.project}-aks-shared"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "${var.project}-aks"
  sku_tier            = "Free" # plan de contrôle gratuit (nœuds facturés)
  tags                = var.tags

  default_node_pool {
    name                 = "system"
    vm_size              = var.node_size
    auto_scaling_enabled = true
    min_count            = var.node_min
    max_count            = var.node_max
    node_count           = var.node_min
    os_disk_size_gb      = 32
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin = "kubenet" # le plus simple / le moins coûteux
  }
}

# --- Autorisation : le kubelet AKS peut tirer les images de l'ACR ---------
resource "azurerm_role_assignment" "aks_acr_pull" {
  scope                            = azurerm_container_registry.acr.id
  role_definition_name             = "AcrPull"
  principal_id                     = azurerm_kubernetes_cluster.aks.kubelet_identity[0].object_id
  skip_service_principal_aad_check = true
}
