variable "subscription_id" {
  description = "ID de souscription Azure (vide = session az login courante)."
  type        = string
  default     = ""
}

variable "project" {
  description = "Préfixe projet (voir docs/AZURE_NAMING.md)."
  type        = string
  default     = "tp"
}

variable "location" {
  description = "Région Azure. francecentral par défaut (quota d'essai variable, sinon westeurope)."
  type        = string
  default     = "francecentral"
}

variable "node_size" {
  description = "SKU des nœuds AKS. B2s = 2 vCPU / 4 Go, le moins cher raisonnable pour une démo."
  type        = string
  default     = "Standard_B2s"
}

variable "node_min" {
  description = "Nombre minimal de nœuds (autoscale)."
  type        = number
  default     = 1
}

variable "node_max" {
  description = "Nombre maximal de nœuds (autoscale)."
  type        = number
  default     = 2
}

variable "tags" {
  description = "Tags obligatoires (voir AZURE_NAMING.md)."
  type        = map(string)
  default = {
    project    = "trustpass"
    owner      = "gaetan"
    costCenter = "demo"
    env        = "shared"
  }
}
