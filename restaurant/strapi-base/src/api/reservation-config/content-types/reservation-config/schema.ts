export default {
  "kind": "singleType",
  "collectionName": "reservation_config",
  "info": {
    "singularName": "reservation-config",
    "pluralName": "reservation-configs",
    "displayName": "Reservation Config"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "maxCoversPerSlot": {
      "type": "integer",
      "required": true,
      "default": 20,
      "min": 1
    }
  }
} as const;
