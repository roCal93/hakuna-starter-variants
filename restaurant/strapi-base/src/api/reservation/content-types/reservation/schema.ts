export default {
  "kind": "collectionType",
  "collectionName": "reservations",
  "info": {
    "singularName": "reservation",
    "pluralName": "reservations",
    "displayName": "Reservation",
    "description": "Restaurant online reservations"
  },
  "options": {
    "draftAndPublish": false
  },
  "pluginOptions": {},
  "attributes": {
    "firstName": {
      "type": "string",
      "required": true
    },
    "lastName": {
      "type": "string",
      "required": true
    },
    "phone": {
      "type": "string",
      "required": true
    },
    "email": {
      "type": "email",
      "required": true
    },
    "date": {
      "type": "date",
      "required": true
    },
    "time": {
      "type": "string",
      "required": true
    },
    "covers": {
      "type": "integer",
      "required": true,
      "min": 1
    },
    "message": {
      "type": "text"
    },
    "status": {
      "type": "enumeration",
      "enum": [
        "pending",
        "confirmed",
        "cancelled"
      ],
      "default": "pending",
      "required": true
    }
  }
} as const;
