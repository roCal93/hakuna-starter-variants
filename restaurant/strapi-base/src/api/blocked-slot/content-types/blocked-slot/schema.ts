export default {
  "kind": "collectionType",
  "collectionName": "blocked_slots",
  "info": {
    "singularName": "blocked-slot",
    "pluralName": "blocked-slots",
    "displayName": "Blocked Slot"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "date": {
      "type": "date",
      "required": true
    },
    "time": {
      "type": "string"
    },
    "label": {
      "type": "string"
    }
  }
} as const;
