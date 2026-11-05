// Layaway ABI - Auto-generated from contract compilation
export const LAYAWAY_ABI = [
  {
    "type": "function",
    "name": "MAX_COUNT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_FORFEIT_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_GRACE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_INSTALMENT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_ITEM_BYTES",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_PAGE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_PERIOD",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_TERMS_BYTES",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_COUNT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_GRACE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_INSTALMENT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_PERIOD",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "OFFER_WINDOW",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "byParty",
    "inputs": [
      {
        "name": "addr",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "count",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "ids",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "list",
        "type": "tuple[]",
        "internalType": "struct Layaway.Plan[]",
        "components": [
          {
            "name": "seller",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "buyer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "instalment",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "count",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "paidCount",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "forfeitBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "periodSecs",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "graceSecs",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "state",
            "type": "uint8",
            "internalType": "enum Layaway.State"
          },
          {
            "name": "startedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "offerBy",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "termsBlock",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "item",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "cancel",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "ifCancelled",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "refund",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "forfeit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "lapse",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "latest",
    "inputs": [
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "count",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "ids",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "list",
        "type": "tuple[]",
        "internalType": "struct Layaway.Plan[]",
        "components": [
          {
            "name": "seller",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "buyer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "instalment",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "count",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "paidCount",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "forfeitBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "periodSecs",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "graceSecs",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "state",
            "type": "uint8",
            "internalType": "enum Layaway.State"
          },
          {
            "name": "startedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "offerBy",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "termsBlock",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "item",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nextDue",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "dueAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "overdue",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "offer",
    "inputs": [
      {
        "name": "buyer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "item",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "terms",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "instalment",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "count",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "periodSecs",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "graceSecs",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "forfeitBps",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "pay",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "pending",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "planCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "planOf",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct Layaway.Plan",
        "components": [
          {
            "name": "seller",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "buyer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "instalment",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "count",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "paidCount",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "forfeitBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "periodSecs",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "graceSecs",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "state",
            "type": "uint8",
            "internalType": "enum Layaway.State"
          },
          {
            "name": "startedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "offerBy",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "termsBlock",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "item",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "retract",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "start",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "withdraw",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Cancelled",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "refunded",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "forfeited",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Completed",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "total",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Lapsed",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "refunded",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "forfeited",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Offered",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "seller",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "buyer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "item",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "terms",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "instalment",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "count",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "periodSecs",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "graceSecs",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "forfeitBps",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "offerBy",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Paid",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "number",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "remaining",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Retracted",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Started",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "startedAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Withdrawn",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyPaid",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadBuyer",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadParams",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadText",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoSuchPlan",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotActive",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotBuyer",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOffered",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOverdue",
    "inputs": [
      {
        "name": "dueAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "graceEnds",
        "type": "uint64",
        "internalType": "uint64"
      }
    ]
  },
  {
    "type": "error",
    "name": "NotSeller",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NothingToWithdraw",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OfferExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrancyGuard",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TransferFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "WrongPayment",
    "inputs": [
      {
        "name": "expected",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  }
] as const;
