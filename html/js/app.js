
    const schema = {
  "asyncapi": "3.0.0",
  "info": {
    "title": "Flame Boss MQTT API",
    "version": "1.0.1",
    "description": "April 29, 2025\n## Overview\n\nAPI for interacting with Flame Boss temperature controllers via MQTT/TCP/IP network and\nBluetooth.\n\nGet the latest version of this document in source code at\n\nhttps://github.com/flameboss/fb-api-doc\n\nand published on the web at\n\nhttps://myflameboss.com/doc/api/index.html\n\n## Message Format\nWe use the following terms:\n\n- The **target** or **device** is the controller or sensor.\n- An **uplink** is a message published by the target for the cloud or your application.\n- A **downlink** is a message published by the cloud or by your application to the target.\n\nEvery message is a JSON object with at least one property with key \"name\".\n\nThe controller sends uplink messages when a setting or reading changes.\n\nAn app can request updates immediately by sending downlink messages with only the name property.\nFor example, to request an immediate update on temperatures, send downlink `{\"name\":\"temps\"}` to the target.\n\n## MQTT\n\nBroker host: myflameboss.com\nProtocol: MQTT v3.1.1\nPort: 8883 for secure TLS connections, 1883 for non-TLS connections\n\n### MQTT Credentials\nSign-up and login at myflameboss.com and visit your dev page to obtain your MQTT credentials:\n\nhttps://myflameboss.com/users/dev\n\n### MQTT Topics\nMost uplinks are published on topic `flameboss/<device_id>/send/data`.\n\nPublic cook data is published on topic `flameboss/<device_id>/send/open`.\n\n(Subscribe to both send topics if the device is added to your account; otherwise just subscribe to the open send topic.)\n\nAll downlinks from your app to the controller are published on topic `flameboss/<device_id>/recv`.\n\n## LAN MQTT\n\nIf your controller is on the same local network as your app, you can send and receive the same JSON messages using the controller's\ninternal MQTT broker on port 1883. Here are the vitals:\n\nProtocol: MQTT (non-TLS) v3.1.1\nPort: 1883\nUsername: fb\nPassword: The Device PIN (shown on the controller's settings screen)\nTopics: Publish downlinks to flameboss/<device_id>/recv and listen for uplinks on flameboss/<device_id>/send/data\n\n## Bluetooth\n\nTargets send and receive the same JSON messages over Bluetooth as they do over the network and MQTT.\n\nAdd a newline after every JSON object when both sending to and receiving from the target.\n\nHere are the UUIDs required.\n\n### BBQ Guru\n\nService:\n\nEA2B0001-C5CE-41A0-A76F-715FB5F63288\n\nCharacteristics:\n\nEA2B0002-C5CE-41A0-A76F-715FB5F63288 Rx (app sends to this characteristic)\n\nEA2B0003-C5CE-41A0-A76F-715FB5F63288 Tx (app reads messages from this characteristic)\n\n### Flame Boss, Egg Genius, Cookshack and other targets\n\nService:\n\n838F0001-5250-4C31-BEBF-4020B71E8574\n\nCharacteristics:\n\n6E400002-B5A3-F393-E0A9-E50E24DCCA9E Rx (app sends to this characteristic)\n\n6E400003-B5A3-F393-E0A9-E50E24DCCA9E Tx  (app reads messages from this characteristic)",
    "license": {
      "name": "Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License",
      "url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"
    }
  },
  "defaultContentType": "application/json",
  "servers": {
    "production": {
      "host": "myflameboss.com",
      "protocol": "mqtts",
      "description": "The production Flame Boss MQTT broker on the default secure port 8883. (Some devices use non-TLS connections on port 1883.)"
    }
  },
  "channels": {
    "flameboss/{deviceId}/send/open": {
      "description": "Public messages sent from the target to subscribers to support shared cooks",
      "parameters": {
        "deviceId": {
          "description": "The integer unique identifier of the Flame Boss device"
        }
      },
      "servers": [
        "$ref:$.servers.production"
      ],
      "messages": {
        "time_up": {
          "tags": [
            {
              "name": "Device"
            }
          ],
          "summary": "Device current time",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "time"
                ],
                "x-parser-schema-id": "<anonymous-schema-3>"
              },
              "epoch": {
                "type": "integer",
                "description": "Time in Unix epoch scale",
                "x-parser-schema-id": "<anonymous-schema-4>"
              },
              "ms": {
                "type": "integer",
                "description": "Fraction of second in ms",
                "x-parser-schema-id": "<anonymous-schema-5>"
              }
            },
            "required": [
              "name",
              "epoch"
            ],
            "example": {
              "name": "time",
              "epoch": 1648224000,
              "ms": 500
            },
            "x-parser-schema-id": "<anonymous-schema-2>"
          },
          "x-parser-unique-object-id": "time_up",
          "x-parser-message-name": "time_up"
        },
        "temps_up": {
          "tags": [
            {
              "name": "Cooking"
            }
          ],
          "summary": "Temperature readings, set temperature, and blower duty cycle information",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "temps"
                ],
                "x-parser-schema-id": "<anonymous-schema-7>"
              },
              "cook_id": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-8>"
              },
              "sec": {
                "type": "integer",
                "description": "Epoch seconds of data point, might be earlier than ts if it was logged on device",
                "x-parser-schema-id": "<anonymous-schema-9>"
              },
              "temps": {
                "type": "array",
                "items": {
                  "type": "integer",
                  "x-parser-schema-id": "<anonymous-schema-11>"
                },
                "description": "Array of integers, temperatures at sec in configured temp scale",
                "x-parser-schema-id": "<anonymous-schema-10>"
              },
              "set_temp": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-12>"
              },
              "blower": {
                "type": "integer",
                "description": "Blower duty cycle in 0.01% scale (e.g. 2500 = 25%, 10000 = 100%)",
                "x-parser-schema-id": "<anonymous-schema-13>"
              }
            },
            "required": [
              "name",
              "cook_id",
              "sec",
              "temps",
              "set_temp",
              "blower"
            ],
            "example": {
              "name": "temps",
              "cook_id": 12345,
              "sec": 1648224000,
              "temps": [
                225,
                180,
                170,
                0
              ],
              "set_temp": 225,
              "blower": 2500
            },
            "x-parser-schema-id": "<anonymous-schema-6>"
          },
          "x-parser-unique-object-id": "temps_up",
          "x-parser-message-name": "temps_up"
        }
      },
      "x-parser-unique-object-id": "flameboss/{deviceId}/send/open"
    },
    "flameboss/{deviceId}/send/data": {
      "description": "Messages sent from the target to subscribers (uplinks)",
      "parameters": {
        "deviceId": {
          "description": "The integer unique identifier of the Flame Boss device"
        }
      },
      "servers": [
        "$ref:$.servers.production"
      ],
      "messages": {
        "time_up": "$ref:$.channels.flameboss/{deviceId}/send/open.messages.time_up",
        "dns_up": {
          "tags": [
            {
              "name": "Network"
            }
          ],
          "summary": "DNS configuration information",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "dns"
                ],
                "x-parser-schema-id": "<anonymous-schema-16>"
              },
              "dhcp": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-17>"
              },
              "ips": {
                "type": "array",
                "items": {
                  "type": "string",
                  "x-parser-schema-id": "<anonymous-schema-19>"
                },
                "description": "Array of strings of IP addresses, all but first element may be ignored",
                "x-parser-schema-id": "<anonymous-schema-18>"
              }
            },
            "required": [
              "name",
              "dhcp",
              "ips"
            ],
            "example": {
              "name": "dns",
              "dhcp": true,
              "ips": [
                "192.168.1.100"
              ]
            },
            "x-parser-schema-id": "<anonymous-schema-15>"
          },
          "x-parser-unique-object-id": "dns_up",
          "x-parser-message-name": "dns_up"
        },
        "ip_up": {
          "tags": [
            {
              "name": "Network"
            }
          ],
          "summary": "IP configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "ip"
                ],
                "x-parser-schema-id": "<anonymous-schema-21>"
              },
              "mode": {
                "type": "string",
                "enum": [
                  "manual",
                  "dhcp"
                ],
                "x-parser-schema-id": "<anonymous-schema-22>"
              },
              "ip": {
                "type": "string",
                "description": "IP address",
                "x-parser-schema-id": "<anonymous-schema-23>"
              },
              "netmask": {
                "type": "string",
                "description": "Netmask",
                "x-parser-schema-id": "<anonymous-schema-24>"
              },
              "gateway": {
                "type": "string",
                "description": "Gateway IP address",
                "x-parser-schema-id": "<anonymous-schema-25>"
              }
            },
            "required": [
              "name",
              "mode",
              "ip",
              "netmask",
              "gateway"
            ],
            "example": {
              "name": "ip",
              "mode": "dhcp",
              "ip": "192.168.1.100",
              "netmask": "255.255.255.0",
              "gateway": "192.168.1.1"
            },
            "x-parser-schema-id": "<anonymous-schema-20>"
          },
          "x-parser-unique-object-id": "ip_up",
          "x-parser-message-name": "ip_up"
        },
        "id_up": {
          "tags": [
            {
              "name": "Device"
            }
          ],
          "summary": "Device identification information",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "id"
                ],
                "x-parser-schema-id": "<anonymous-schema-27>"
              },
              "hw_id": {
                "type": "integer",
                "description": "Device type ID",
                "x-parser-schema-id": "<anonymous-schema-28>"
              },
              "device_id": {
                "type": "integer",
                "description": "Flame Boss device ID",
                "x-parser-schema-id": "<anonymous-schema-29>"
              },
              "uid": {
                "type": "string",
                "description": "Base64 encoded UID",
                "x-parser-schema-id": "<anonymous-schema-30>"
              },
              "pin": {
                "type": "integer",
                "description": "Optional, only sent when device is in AP mode",
                "x-parser-schema-id": "<anonymous-schema-31>"
              }
            },
            "required": [
              "name",
              "hw_id",
              "device_id",
              "uid"
            ],
            "example": {
              "name": "id",
              "hw_id": 123,
              "device_id": 456,
              "uid": "ABC123DEF456=="
            },
            "x-parser-schema-id": "<anonymous-schema-26>"
          },
          "x-parser-unique-object-id": "id_up",
          "x-parser-message-name": "id_up"
        },
        "temps_up": "$ref:$.channels.flameboss/{deviceId}/send/open.messages.temps_up",
        "set_temp_up": {
          "tags": [
            {
              "name": "Cooking"
            }
          ],
          "summary": "Set temperature",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "set_temp"
                ],
                "x-parser-schema-id": "<anonymous-schema-33>"
              },
              "min": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-34>"
              },
              "max": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-35>"
              }
            },
            "required": [
              "name",
              "min",
              "max"
            ],
            "example": {
              "name": "set_temp",
              "min": 150,
              "max": 500
            },
            "x-parser-schema-id": "<anonymous-schema-32>"
          },
          "x-parser-unique-object-id": "set_temp_up",
          "x-parser-message-name": "set_temp_up"
        },
        "wifi_up": {
          "tags": [
            {
              "name": "Network"
            }
          ],
          "summary": "WiFi configuration information",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "wifi"
                ],
                "x-parser-schema-id": "<anonymous-schema-37>"
              },
              "index": {
                "type": "integer",
                "enum": [
                  0,
                  1
                ],
                "description": "Omitting index is equivalent to index = 0",
                "x-parser-schema-id": "<anonymous-schema-38>"
              },
              "ssid": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-39>"
              },
              "key": {
                "type": "string",
                "description": "May be omitted on some channels for security policy",
                "x-parser-schema-id": "<anonymous-schema-40>"
              }
            },
            "required": [
              "name",
              "ssid",
              "key"
            ],
            "example": {
              "name": "wifi",
              "index": 0,
              "ssid": "MyWifiNetwork",
              "key": "my-wifi-pw"
            },
            "x-parser-schema-id": "<anonymous-schema-36>"
          },
          "x-parser-unique-object-id": "wifi_up",
          "x-parser-message-name": "wifi_up"
        },
        "wifi_cx_up": {
          "tags": [
            {
              "name": "Network"
            }
          ],
          "summary": "WiFi connection information",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "wifi_cx"
                ],
                "x-parser-schema-id": "<anonymous-schema-42>"
              },
              "connected": {
                "type": "boolean",
                "description": "wifi is connected to an access point",
                "x-parser-schema-id": "<anonymous-schema-43>"
              }
            },
            "required": [
              "name",
              "connected"
            ],
            "example": {
              "name": "wifi_cx",
              "connected": true
            },
            "x-parser-schema-id": "<anonymous-schema-41>"
          },
          "x-parser-unique-object-id": "wifi_cx_up",
          "x-parser-message-name": "wifi_cx_up"
        },
        "meat_alarm_up": {
          "tags": [
            {
              "name": "Alarms"
            }
          ],
          "summary": "Meat alarm configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "meat_alarm"
                ],
                "x-parser-schema-id": "<anonymous-schema-45>"
              },
              "sensor": {
                "type": "integer",
                "minimum": 1,
                "maximum": 3,
                "x-parser-schema-id": "<anonymous-schema-46>"
              },
              "action": {
                "type": "string",
                "enum": [
                  "off",
                  "on",
                  "keep_warm"
                ],
                "x-parser-schema-id": "<anonymous-schema-47>"
              },
              "done_temp": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-48>"
              },
              "warm_temp": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-49>"
              }
            },
            "required": [
              "name",
              "sensor",
              "action",
              "done_temp",
              "warm_temp"
            ],
            "example": {
              "name": "meat_alarm",
              "sensor": 1,
              "action": "on",
              "done_temp": 203,
              "warm_temp": 170
            },
            "x-parser-schema-id": "<anonymous-schema-44>"
          },
          "x-parser-unique-object-id": "meat_alarm_up",
          "x-parser-message-name": "meat_alarm_up"
        },
        "set_temp_limits_up": {
          "tags": [
            {
              "name": "Cooking"
            }
          ],
          "summary": "Temperature limit settings",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "set_temp_limits"
                ],
                "x-parser-schema-id": "<anonymous-schema-51>"
              },
              "min": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-52>"
              },
              "max": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-53>"
              }
            },
            "required": [
              "name",
              "min",
              "max"
            ],
            "example": {
              "name": "set_temp_limits",
              "min": 150,
              "max": 500
            },
            "x-parser-schema-id": "<anonymous-schema-50>"
          },
          "x-parser-unique-object-id": "set_temp_limits_up",
          "x-parser-message-name": "set_temp_limits_up"
        },
        "pit_alarm_up": {
          "tags": [
            {
              "name": "Alarms"
            }
          ],
          "summary": "Pit alarm configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "pit_alarm"
                ],
                "x-parser-schema-id": "<anonymous-schema-55>"
              },
              "enabled": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-56>"
              },
              "range": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-57>"
              }
            },
            "required": [
              "name",
              "enabled",
              "range"
            ],
            "example": {
              "name": "pit_alarm",
              "enabled": true,
              "range": 25
            },
            "x-parser-schema-id": "<anonymous-schema-54>"
          },
          "x-parser-unique-object-id": "pit_alarm_up",
          "x-parser-message-name": "pit_alarm_up"
        },
        "labels_up": {
          "tags": [
            {
              "name": "Cooking"
            }
          ],
          "summary": "Probe labels",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "labels"
                ],
                "x-parser-schema-id": "<anonymous-schema-59>"
              },
              "values": {
                "type": "array",
                "items": {
                  "type": "string",
                  "x-parser-schema-id": "<anonymous-schema-61>"
                },
                "maxItems": 4,
                "description": "Array of 4 strings, max 12 char each",
                "x-parser-schema-id": "<anonymous-schema-60>"
              }
            },
            "required": [
              "name",
              "values"
            ],
            "example": {
              "name": "labels",
              "values": [
                "Pit",
                "Brisket",
                "Butt",
                "Turkey"
              ]
            },
            "x-parser-schema-id": "<anonymous-schema-58>"
          },
          "x-parser-unique-object-id": "labels_up",
          "x-parser-message-name": "labels_up"
        },
        "sound_up": {
          "tags": [
            {
              "name": "Device"
            }
          ],
          "summary": "Sound configuration and status",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "sound"
                ],
                "x-parser-schema-id": "<anonymous-schema-63>"
              },
              "config": {
                "type": "string",
                "enum": [
                  "off",
                  "chirps",
                  "alarms"
                ],
                "x-parser-schema-id": "<anonymous-schema-64>"
              },
              "status": {
                "type": "string",
                "enum": [
                  "alarm",
                  "off"
                ],
                "x-parser-schema-id": "<anonymous-schema-65>"
              }
            },
            "required": [
              "name",
              "config",
              "status"
            ],
            "example": {
              "name": "sound",
              "config": "chirps",
              "status": "off"
            },
            "x-parser-schema-id": "<anonymous-schema-62>"
          },
          "x-parser-unique-object-id": "sound_up",
          "x-parser-message-name": "sound_up"
        },
        "pid_up": {
          "tags": [
            {
              "name": "Fan Control"
            }
          ],
          "summary": "PID controller configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "pid"
                ],
                "x-parser-schema-id": "<anonymous-schema-67>"
              },
              "p": {
                "type": "integer",
                "description": "p * 100",
                "x-parser-schema-id": "<anonymous-schema-68>"
              },
              "i": {
                "type": "integer",
                "description": "i * 1000",
                "x-parser-schema-id": "<anonymous-schema-69>"
              },
              "d": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-70>"
              },
              "ff": {
                "type": "integer",
                "description": "Learned duty cycle when no error from adaptive feed forward method",
                "x-parser-schema-id": "<anonymous-schema-71>"
              },
              "min_dc": {
                "type": "integer",
                "description": "Minimum duty cycle",
                "x-parser-schema-id": "<anonymous-schema-72>"
              },
              "pvl": {
                "type": "integer",
                "description": "Process value limit, caps output at this number * pit temp",
                "x-parser-schema-id": "<anonymous-schema-73>"
              }
            },
            "required": [
              "name",
              "p",
              "i",
              "d",
              "ff",
              "min_dc",
              "pvl"
            ],
            "example": {
              "name": "pid",
              "p": 1000,
              "i": 500,
              "d": 250,
              "ff": 3000,
              "min_dc": 1500,
              "pvl": 2
            },
            "x-parser-schema-id": "<anonymous-schema-66>"
          },
          "x-parser-unique-object-id": "pid_up",
          "x-parser-message-name": "pid_up"
        },
        "gpid_up": {
          "tags": [
            {
              "name": "Fan Control"
            }
          ],
          "summary": "BBQ Guru PID controller configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "gpid"
                ],
                "x-parser-schema-id": "<anonymous-schema-75>"
              },
              "ramp": {
                "type": "integer",
                "minimum": 0,
                "maximum": 4,
                "description": "Ramp, 0 = disabled, 1-3 = ramp pit temp to maintain the food target temp on that probe",
                "x-parser-schema-id": "<anonymous-schema-76>"
              },
              "sc": {
                "type": "integer",
                "minimum": 0,
                "maximum": 4,
                "description": "Smart cook setting",
                "x-parser-schema-id": "<anonymous-schema-77>"
              },
              "cyc": {
                "type": "integer",
                "minimum": 1,
                "maximum": 10,
                "description": "Cycle time in seconds when smart cook setting is 4",
                "x-parser-schema-id": "<anonymous-schema-78>"
              },
              "prop": {
                "type": "integer",
                "minimum": 10,
                "maximum": 50,
                "description": "Proportional band in degrees F when smart cook is 4",
                "x-parser-schema-id": "<anonymous-schema-79>"
              }
            },
            "required": [
              "name",
              "ramp",
              "sc",
              "cyc",
              "prop"
            ],
            "example": {
              "name": "gpid",
              "ramp": 0,
              "sc": 2,
              "cyc": 5,
              "prop": 25
            },
            "x-parser-schema-id": "<anonymous-schema-74>"
          },
          "x-parser-unique-object-id": "gpid_up",
          "x-parser-message-name": "gpid_up"
        },
        "open_pit_up": {
          "tags": [
            {
              "name": "Fan Control"
            }
          ],
          "summary": "Open pit configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "open_pit"
                ],
                "x-parser-schema-id": "<anonymous-schema-81>"
              },
              "enabled": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-82>"
              },
              "max_pause": {
                "type": "integer",
                "description": "Max open pause time in seconds",
                "x-parser-schema-id": "<anonymous-schema-83>"
              }
            },
            "required": [
              "name",
              "enabled",
              "max_pause"
            ],
            "example": {
              "name": "open_pit",
              "max_pause": 300
            },
            "x-parser-schema-id": "<anonymous-schema-80>"
          },
          "x-parser-unique-object-id": "open_pit_up",
          "x-parser-message-name": "open_pit_up"
        },
        "step_up": {
          "tags": [
            {
              "name": "Cooking"
            }
          ],
          "summary": "Step configuration and status",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "step"
                ],
                "x-parser-schema-id": "<anonymous-schema-85>"
              },
              "index": {
                "type": "integer",
                "description": "0-based step",
                "x-parser-schema-id": "<anonymous-schema-86>"
              },
              "active": {
                "type": "boolean",
                "description": "Currently on this step",
                "x-parser-schema-id": "<anonymous-schema-87>"
              },
              "step_name": {
                "type": "string",
                "description": "Name of step",
                "x-parser-schema-id": "<anonymous-schema-88>"
              },
              "set_temp": {
                "type": "integer",
                "description": "Set temp to hold during this step",
                "x-parser-schema-id": "<anonymous-schema-89>"
              },
              "end_by": {
                "type": "string",
                "enum": [
                  "time",
                  "temp",
                  "none"
                ],
                "x-parser-schema-id": "<anonymous-schema-90>"
              },
              "time": {
                "type": "integer",
                "description": "Time this step lasts in seconds if end_by == time",
                "x-parser-schema-id": "<anonymous-schema-91>"
              },
              "temp": {
                "type": "integer",
                "description": "Target temp that causes to next step if end_by == temp",
                "x-parser-schema-id": "<anonymous-schema-92>"
              },
              "sensor": {
                "type": "integer",
                "description": "Sensor used for target temp if end_by = temp (default 1 aka meat 1)",
                "x-parser-schema-id": "<anonymous-schema-93>"
              },
              "started_at": {
                "type": "integer",
                "description": "Epoch this step started",
                "x-parser-schema-id": "<anonymous-schema-94>"
              }
            },
            "required": [
              "name",
              "index",
              "active",
              "step_name",
              "set_temp",
              "end_by"
            ],
            "example": {
              "name": "step",
              "index": 0,
              "active": true,
              "step_name": "Smoke",
              "set_temp": 225,
              "end_by": "time",
              "time": 7200,
              "started_at": 1648224000
            },
            "x-parser-schema-id": "<anonymous-schema-84>"
          },
          "x-parser-unique-object-id": "step_up",
          "x-parser-message-name": "step_up"
        },
        "device_temp_up": {
          "tags": [
            {
              "name": "Device"
            }
          ],
          "summary": "Device temperature",
          "description": "This message is sent when it changes 5 degrees C or 1 degree if device temp is high. (Not supported on 400.)",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "device_temp"
                ],
                "x-parser-schema-id": "<anonymous-schema-96>"
              },
              "value": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-97>"
              }
            },
            "required": [
              "name",
              "value"
            ],
            "example": {
              "name": "device_temp",
              "value": 85
            },
            "x-parser-schema-id": "<anonymous-schema-95>"
          },
          "x-parser-unique-object-id": "device_temp_up",
          "x-parser-message-name": "device_temp_up"
        },
        "dc_input_up": {
          "tags": [
            {
              "name": "Device"
            }
          ],
          "summary": "DC input voltage",
          "description": "This uplink is published when dc_input changes 0.1 volts.",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "dc_input"
                ],
                "x-parser-schema-id": "<anonymous-schema-99>"
              },
              "value": {
                "type": "integer",
                "description": "Input voltage in decivolts",
                "x-parser-schema-id": "<anonymous-schema-100>"
              }
            },
            "required": [
              "name",
              "value"
            ],
            "example": {
              "name": "dc_input",
              "value": 120
            },
            "x-parser-schema-id": "<anonymous-schema-98>"
          },
          "x-parser-unique-object-id": "dc_input_up",
          "x-parser-message-name": "dc_input_up"
        },
        "meat_alarm_triggered_up": {
          "tags": [
            {
              "name": "Alarms"
            }
          ],
          "summary": "Meat alarm triggered",
          "description": "This uplink is published when the meat is done.",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "meat_alarm_triggered"
                ],
                "x-parser-schema-id": "<anonymous-schema-102>"
              },
              "sensor": {
                "type": "integer",
                "minimum": 1,
                "maximum": 3,
                "x-parser-schema-id": "<anonymous-schema-103>"
              }
            },
            "required": [
              "name",
              "sensor"
            ],
            "example": {
              "name": "meat_alarm_triggered",
              "sensor": 1
            },
            "x-parser-schema-id": "<anonymous-schema-101>"
          },
          "x-parser-unique-object-id": "meat_alarm_triggered_up",
          "x-parser-message-name": "meat_alarm_triggered_up"
        },
        "pit_alarm_active_up": {
          "tags": [
            {
              "name": "Alarms"
            }
          ],
          "summary": "Pit alarm active",
          "description": "This uplink is published when pit alarm becomes active after being enabled. (It becomes active when the pit temp becomes nearly at the set temp.",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "pit_alarm_active"
                ],
                "x-parser-schema-id": "<anonymous-schema-105>"
              }
            },
            "required": [
              "name"
            ],
            "example": {
              "name": "pit_alarm_active"
            },
            "x-parser-schema-id": "<anonymous-schema-104>"
          },
          "x-parser-unique-object-id": "pit_alarm_active_up",
          "x-parser-message-name": "pit_alarm_active_up"
        },
        "pit_alarm_triggered_up": {
          "tags": [
            {
              "name": "Alarms"
            }
          ],
          "summary": "Pit alarm triggered",
          "description": "This uplink is published when the pit temp goes out of range set by pit alarm if the pit alarm is active.",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "pit_alarm_triggered"
                ],
                "x-parser-schema-id": "<anonymous-schema-107>"
              }
            },
            "required": [
              "name"
            ],
            "example": {
              "name": "pit_alarm_triggered"
            },
            "x-parser-schema-id": "<anonymous-schema-106>"
          },
          "x-parser-unique-object-id": "pit_alarm_triggered_up",
          "x-parser-message-name": "pit_alarm_triggered_up"
        },
        "vent_advice_up": {
          "tags": [
            {
              "name": "Alarms"
            }
          ],
          "summary": "Vent advice",
          "description": "This uplink is published when pit temp has been above set temp for a long time.",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "vent_advice"
                ],
                "x-parser-schema-id": "<anonymous-schema-109>"
              }
            },
            "required": [
              "name"
            ],
            "example": {
              "name": "vent_advice"
            },
            "x-parser-schema-id": "<anonymous-schema-108>"
          },
          "x-parser-unique-object-id": "vent_advice_up",
          "x-parser-message-name": "vent_advice_up"
        },
        "opened_up": {
          "tags": [
            {
              "name": "Deprecated"
            }
          ],
          "summary": "Cooker opened - DEPRECATED - use openPitUplink instead",
          "description": "This uplink is published when the controller detects the cooker is opened.",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "opened"
                ],
                "x-parser-schema-id": "<anonymous-schema-111>"
              }
            },
            "required": [
              "name"
            ],
            "example": {
              "name": "opened"
            },
            "x-parser-schema-id": "<anonymous-schema-110>"
          },
          "x-parser-unique-object-id": "opened_up",
          "x-parser-message-name": "opened_up"
        },
        "closed_up": {
          "tags": [
            {
              "name": "Deprecated"
            }
          ],
          "summary": "Cooker closed - DEPRECATED - use openPitUplink instead",
          "description": "This uplink is published when the controller detects the cooker is closed.",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "closed"
                ],
                "x-parser-schema-id": "<anonymous-schema-113>"
              }
            },
            "required": [
              "name"
            ],
            "example": {
              "name": "closed"
            },
            "x-parser-schema-id": "<anonymous-schema-112>"
          },
          "x-parser-unique-object-id": "closed_up",
          "x-parser-message-name": "closed_up"
        },
        "probe_overtemp_up": {
          "tags": [
            {
              "name": "Alarms"
            }
          ],
          "summary": "Probe overtemperature",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "probe_overtemp"
                ],
                "x-parser-schema-id": "<anonymous-schema-115>"
              },
              "sensor": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-116>"
              }
            },
            "required": [
              "name",
              "sensor"
            ],
            "example": {
              "name": "probe_overtemp",
              "sensor": 1
            },
            "x-parser-schema-id": "<anonymous-schema-114>"
          },
          "x-parser-unique-object-id": "probe_overtemp_up",
          "x-parser-message-name": "probe_overtemp_up"
        },
        "device_overtemp_up": {
          "tags": [
            {
              "name": "Alarms"
            }
          ],
          "summary": "Device overtemperature",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "device_overtemp"
                ],
                "x-parser-schema-id": "<anonymous-schema-118>"
              }
            },
            "required": [
              "name"
            ],
            "example": {
              "name": "device_overtemp"
            },
            "x-parser-schema-id": "<anonymous-schema-117>"
          },
          "x-parser-unique-object-id": "device_overtemp_up",
          "x-parser-message-name": "device_overtemp_up"
        },
        "wifi_scan_up": {
          "tags": [
            {
              "name": "Network"
            }
          ],
          "summary": "WiFi scan results",
          "description": "This uplink is published at startup, and in response to wifi_scan downlink, to show results of discovered access points, one message for each AP discovered.",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "wifi_scan"
                ],
                "x-parser-schema-id": "<anonymous-schema-120>"
              },
              "index": {
                "type": "integer",
                "description": "the index from 0 to count - 1 of this message response to the wifi_scan downlink",
                "x-parser-schema-id": "<anonymous-schema-121>"
              },
              "count": {
                "type": "integer",
                "description": "how many wifi_scan messages are being sent in one response to the wifi_scan downlink",
                "x-parser-schema-id": "<anonymous-schema-122>"
              },
              "ssid": {
                "type": "string",
                "description": "the ssid of the access point",
                "x-parser-schema-id": "<anonymous-schema-123>"
              },
              "rssi": {
                "type": "integer",
                "description": "rssi x 10",
                "x-parser-schema-id": "<anonymous-schema-124>"
              },
              "bssid": {
                "type": "string",
                "description": "optional, bssid of AP",
                "x-parser-schema-id": "<anonymous-schema-125>"
              }
            },
            "required": [
              "name",
              "index",
              "count",
              "ssid",
              "rssi"
            ],
            "example": {
              "name": "wifi_scan",
              "index": 0,
              "count": 5,
              "ssid": "fb",
              "rssi": -550
            },
            "x-parser-schema-id": "<anonymous-schema-119>"
          },
          "x-parser-unique-object-id": "wifi_scan_up",
          "x-parser-message-name": "wifi_scan_up"
        },
        "ble_cx_up": {
          "tags": [
            {
              "name": "Network"
            }
          ],
          "summary": "BLE connection status",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "ble_cx"
                ],
                "x-parser-schema-id": "<anonymous-schema-127>"
              },
              "connected": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-128>"
              }
            },
            "required": [
              "name",
              "connected"
            ],
            "example": {
              "name": "ble_cx",
              "connected": true
            },
            "x-parser-schema-id": "<anonymous-schema-126>"
          },
          "x-parser-unique-object-id": "ble_cx_up",
          "x-parser-message-name": "ble_cx_up"
        },
        "timer_up": {
          "tags": [
            {
              "name": "Cooking"
            }
          ],
          "summary": "Timer configuration and status",
          "description": "The timer value, if action is not none, counts down. When it gets to zero, the action is performed, either changing the internal/effective set temperature to the hold temperature (hold), or sending an alert (alarm).",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "timer"
                ],
                "x-parser-schema-id": "<anonymous-schema-130>"
              },
              "action": {
                "type": "string",
                "enum": [
                  "none",
                  "hold",
                  "alarm"
                ],
                "description": "what to do when the timer expires. If hold, change the internal set temperature to the hold temperature.",
                "x-parser-schema-id": "<anonymous-schema-131>"
              },
              "value": {
                "type": "integer",
                "description": "start value of the timer in seconds",
                "x-parser-schema-id": "<anonymous-schema-132>"
              },
              "hold": {
                "type": "integer",
                "description": "the hold temperature",
                "x-parser-schema-id": "<anonymous-schema-133>"
              },
              "ends_at": {
                "type": "integer",
                "description": "if status is active, this is the timestamp when the timer will expire.",
                "x-parser-schema-id": "<anonymous-schema-134>"
              },
              "status": {
                "type": "string",
                "enum": [
                  "off",
                  "active",
                  "triggered"
                ],
                "description": "If status is triggered and action is hold, the controller has an effective set temperature equal to the hold temperature.\nIf status is triggered and action is alarm, the controller is alerting.\nNote: this property is redundant and can be computed from action and ends_at.\nHowever, it might be different than the computed value temporarily due to time differences\nbetween the target and its communicating peers.",
                "x-parser-schema-id": "<anonymous-schema-135>"
              }
            },
            "required": [
              "name",
              "action",
              "value",
              "status",
              "ends_at"
            ],
            "example": {
              "name": "timer",
              "action": "hold",
              "value": 3600,
              "status": "active",
              "ends_at": 1747429645
            },
            "x-parser-schema-id": "<anonymous-schema-129>"
          },
          "x-parser-unique-object-id": "timer_up",
          "x-parser-message-name": "timer_up"
        },
        "state_up": {
          "tags": [
            {
              "name": "Device"
            }
          ],
          "summary": "Says what state the cooker is in: idle, run, error, production (trying to pass the production test)",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "state"
                ],
                "x-parser-schema-id": "<anonymous-schema-137>"
              },
              "value": {
                "type": "string",
                "enum": [
                  "idle",
                  "run",
                  "error",
                  "production"
                ],
                "x-parser-schema-id": "<anonymous-schema-138>"
              }
            },
            "required": [
              "name",
              "value"
            ],
            "example": {
              "name": "state",
              "type": "run"
            },
            "x-parser-schema-id": "<anonymous-schema-136>"
          },
          "x-parser-unique-object-id": "state_up",
          "x-parser-message-name": "state_up"
        }
      },
      "x-parser-unique-object-id": "flameboss/{deviceId}/send/data"
    },
    "flameboss/{deviceId}/recv": {
      "summary": "Messages sent to the target (downlinks)",
      "description": "Publish messages to this topic to control the target or request data from the target.\nTo request updates, send a message with only the name property.\nFor example: `{\"name\": \"temps\"}`\nTo request update of all settings and readings, publish a sync message to\nthis topic.\nFor example: '{\"name\": \"sync\"}'\n",
      "parameters": {
        "deviceId": {
          "description": "The integer unique identifier of the Flame Boss target"
        }
      },
      "servers": [
        "$ref:$.servers.production"
      ],
      "messages": {
        "time_down": {
          "tags": [
            {
              "name": "Device"
            }
          ],
          "summary": "Set device time or request device time",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "time"
                ],
                "x-parser-schema-id": "<anonymous-schema-141>"
              },
              "epoch": {
                "type": "integer",
                "description": "Time in Unix epoch scale",
                "x-parser-schema-id": "<anonymous-schema-142>"
              },
              "ms": {
                "type": "integer",
                "description": "Fraction of second in ms",
                "x-parser-schema-id": "<anonymous-schema-143>"
              }
            },
            "required": [
              "name"
            ],
            "example": {
              "name": "time",
              "epoch": 1648224000,
              "ms": 500
            },
            "x-parser-schema-id": "<anonymous-schema-140>"
          },
          "x-parser-unique-object-id": "time_down",
          "x-parser-message-name": "time_down"
        },
        "dns_down": {
          "tags": [
            {
              "name": "Network"
            }
          ],
          "summary": "Set DNS configuration or request DNS configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "dns"
                ],
                "x-parser-schema-id": "<anonymous-schema-145>"
              },
              "dhcp": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-146>"
              },
              "ips": {
                "type": "array",
                "items": {
                  "type": "string",
                  "x-parser-schema-id": "<anonymous-schema-148>"
                },
                "description": "Array of strings of IP addresses.\nAll but first element may be ignored if the device\ndoes not support more than one DNS address.\nThis property is required if dhcp is false, and optional-and-ignored if dhcp is true.",
                "x-parser-schema-id": "<anonymous-schema-147>"
              }
            },
            "required": [
              "name",
              "dhcp"
            ],
            "example": {
              "name": "dns",
              "dhcp": true
            },
            "x-parser-schema-id": "<anonymous-schema-144>"
          },
          "x-parser-unique-object-id": "dns_down",
          "x-parser-message-name": "dns_down"
        },
        "ip_down": {
          "tags": [
            {
              "name": "Network"
            }
          ],
          "summary": "Set or request IP configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "ip"
                ],
                "x-parser-schema-id": "<anonymous-schema-150>"
              },
              "mode": {
                "type": "string",
                "enum": [
                  "manual",
                  "dhcp"
                ],
                "x-parser-schema-id": "<anonymous-schema-151>"
              },
              "ip": {
                "type": "string",
                "description": "IP address",
                "x-parser-schema-id": "<anonymous-schema-152>"
              },
              "netmask": {
                "type": "string",
                "description": "Netmask",
                "x-parser-schema-id": "<anonymous-schema-153>"
              },
              "gateway": {
                "type": "string",
                "description": "Gateway IP address",
                "x-parser-schema-id": "<anonymous-schema-154>"
              }
            },
            "required": [
              "name",
              "mode",
              "ip",
              "netmask",
              "gateway"
            ],
            "example": {
              "name": "ip",
              "mode": "dhcp",
              "ip": "192.168.1.100",
              "netmask": "255.255.255.0",
              "gateway": "192.168.1.1"
            },
            "x-parser-schema-id": "<anonymous-schema-149>"
          },
          "x-parser-unique-object-id": "ip_down",
          "x-parser-message-name": "ip_down"
        },
        "id_down": {
          "tags": [
            {
              "name": "Device"
            }
          ],
          "summary": "Request device identification information",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "id"
                ],
                "x-parser-schema-id": "<anonymous-schema-156>"
              }
            },
            "required": [
              "name"
            ],
            "example": {
              "name": "id"
            },
            "x-parser-schema-id": "<anonymous-schema-155>"
          },
          "x-parser-unique-object-id": "id_down",
          "x-parser-message-name": "id_down"
        },
        "set_temp_down": {
          "tags": [
            {
              "name": "Cooking"
            }
          ],
          "summary": "Request set temperature",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "set_temp"
                ],
                "x-parser-schema-id": "<anonymous-schema-158>"
              },
              "value": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-159>"
              }
            },
            "required": [
              "name",
              "value"
            ],
            "example": {
              "name": "set_temp",
              "value": 250
            },
            "x-parser-schema-id": "<anonymous-schema-157>"
          },
          "x-parser-unique-object-id": "set_temp_down",
          "x-parser-message-name": "set_temp_down"
        },
        "wifi_down": {
          "tags": [
            {
              "name": "Network"
            }
          ],
          "summary": "Set or request WiFi configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "wifi"
                ],
                "x-parser-schema-id": "<anonymous-schema-161>"
              },
              "index": {
                "type": "integer",
                "enum": [
                  0,
                  1
                ],
                "description": "Omitting index is equivalent to index = 0",
                "x-parser-schema-id": "<anonymous-schema-162>"
              },
              "ssid": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-163>"
              },
              "key": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-164>"
              }
            },
            "required": [
              "name",
              "ssid"
            ],
            "example": {
              "name": "wifi",
              "index": 0,
              "ssid": "MyWifiNetwork",
              "key": "wifi-password"
            },
            "x-parser-schema-id": "<anonymous-schema-160>"
          },
          "x-parser-unique-object-id": "wifi_down",
          "x-parser-message-name": "wifi_down"
        },
        "wifi_scan_down": {
          "tags": [
            {
              "name": "Network"
            }
          ],
          "summary": "Request WiFi scan",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "wifi_scan"
                ],
                "x-parser-schema-id": "<anonymous-schema-166>"
              }
            },
            "required": [
              "name"
            ],
            "example": {
              "name": "wifi_scan"
            },
            "x-parser-schema-id": "<anonymous-schema-165>"
          },
          "x-parser-unique-object-id": "wifi_scan_down",
          "x-parser-message-name": "wifi_scan_down"
        },
        "ble_cx_down": {
          "tags": [
            {
              "name": "Network"
            }
          ],
          "summary": "Get the status of the BLE interface",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "ble_cx"
                ],
                "x-parser-schema-id": "<anonymous-schema-168>"
              }
            },
            "required": [
              "name"
            ],
            "example": {
              "name": "ble_cx"
            },
            "x-parser-schema-id": "<anonymous-schema-167>"
          },
          "x-parser-unique-object-id": "ble_cx_down",
          "x-parser-message-name": "ble_cx_down"
        },
        "meat_alarm_down": {
          "tags": [
            {
              "name": "Alarms"
            }
          ],
          "summary": "Set meat alarm configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "meat_alarm"
                ],
                "x-parser-schema-id": "<anonymous-schema-170>"
              },
              "sensor": {
                "type": "integer",
                "minimum": 1,
                "maximum": 3,
                "x-parser-schema-id": "<anonymous-schema-171>"
              },
              "action": {
                "type": "string",
                "enum": [
                  "off",
                  "on",
                  "keep_warm"
                ],
                "x-parser-schema-id": "<anonymous-schema-172>"
              },
              "done_temp": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-173>"
              },
              "warm_temp": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-174>"
              }
            },
            "required": [
              "name",
              "sensor",
              "action",
              "done_temp",
              "warm_temp"
            ],
            "example": {
              "name": "meat_alarm",
              "sensor": 1,
              "action": "on",
              "done_temp": 203,
              "warm_temp": 170
            },
            "x-parser-schema-id": "<anonymous-schema-169>"
          },
          "x-parser-unique-object-id": "meat_alarm_down",
          "x-parser-message-name": "meat_alarm_down"
        },
        "pit_alarm_down": {
          "tags": [
            {
              "name": "Alarms"
            }
          ],
          "summary": "Set pit alarm configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "pit_alarm"
                ],
                "x-parser-schema-id": "<anonymous-schema-176>"
              },
              "enabled": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-177>"
              },
              "range": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-178>"
              }
            },
            "required": [
              "name",
              "enabled",
              "range"
            ],
            "example": {
              "name": "pit_alarm",
              "enabled": true,
              "range": 25
            },
            "x-parser-schema-id": "<anonymous-schema-175>"
          },
          "x-parser-unique-object-id": "pit_alarm_down",
          "x-parser-message-name": "pit_alarm_down"
        },
        "labels_down": {
          "tags": [
            {
              "name": "Cooking"
            }
          ],
          "summary": "Set probe labels",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "labels"
                ],
                "x-parser-schema-id": "<anonymous-schema-180>"
              },
              "values": {
                "type": "array",
                "items": {
                  "type": "string",
                  "x-parser-schema-id": "<anonymous-schema-182>"
                },
                "maxItems": 4,
                "description": "Array of 4 strings, max 12 char each",
                "x-parser-schema-id": "<anonymous-schema-181>"
              }
            },
            "required": [
              "name",
              "values"
            ],
            "example": {
              "name": "labels",
              "values": [
                "Pit",
                "Brisket",
                "Butt",
                "Turkey"
              ]
            },
            "x-parser-schema-id": "<anonymous-schema-179>"
          },
          "x-parser-unique-object-id": "labels_down",
          "x-parser-message-name": "labels_down"
        },
        "sound_down": {
          "tags": [
            {
              "name": "Device"
            }
          ],
          "summary": "Set sound configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "sound"
                ],
                "x-parser-schema-id": "<anonymous-schema-184>"
              },
              "config": {
                "type": "string",
                "enum": [
                  "off",
                  "chirps",
                  "alarms"
                ],
                "x-parser-schema-id": "<anonymous-schema-185>"
              }
            },
            "required": [
              "name",
              "config"
            ],
            "example": {
              "name": "sound",
              "config": "chirps"
            },
            "x-parser-schema-id": "<anonymous-schema-183>"
          },
          "x-parser-unique-object-id": "sound_down",
          "x-parser-message-name": "sound_down"
        },
        "pid_down": {
          "tags": [
            {
              "name": "Fan Control"
            }
          ],
          "summary": "Set PID controller configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "pid"
                ],
                "x-parser-schema-id": "<anonymous-schema-187>"
              },
              "p": {
                "type": "integer",
                "description": "p * 100",
                "x-parser-schema-id": "<anonymous-schema-188>"
              },
              "i": {
                "type": "integer",
                "description": "i * 1000",
                "x-parser-schema-id": "<anonymous-schema-189>"
              },
              "d": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-190>"
              },
              "ff": {
                "type": "integer",
                "description": "Learned duty cycle when no error from adaptive feed forward method",
                "x-parser-schema-id": "<anonymous-schema-191>"
              },
              "min_dc": {
                "type": "integer",
                "description": "Minimum duty cycle",
                "x-parser-schema-id": "<anonymous-schema-192>"
              },
              "pvl": {
                "type": "integer",
                "description": "Process value limit, caps output at this number * pit temp",
                "x-parser-schema-id": "<anonymous-schema-193>"
              }
            },
            "required": [
              "name",
              "p",
              "i",
              "d",
              "ff",
              "min_dc",
              "pvl"
            ],
            "example": {
              "name": "pid",
              "p": 1000,
              "i": 500,
              "d": 250,
              "ff": 3000,
              "min_dc": 1500,
              "pvl": 2
            },
            "x-parser-schema-id": "<anonymous-schema-186>"
          },
          "x-parser-unique-object-id": "pid_down",
          "x-parser-message-name": "pid_down"
        },
        "gpid_down": {
          "tags": [
            {
              "name": "Fan Control"
            }
          ],
          "summary": "Set BBQ Guru PID controller configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "gpid"
                ],
                "x-parser-schema-id": "<anonymous-schema-195>"
              },
              "sc": {
                "type": "integer",
                "minimum": 0,
                "maximum": 4,
                "description": "Smart cook setting",
                "x-parser-schema-id": "<anonymous-schema-196>"
              },
              "cyc": {
                "type": "integer",
                "minimum": 1,
                "maximum": 10,
                "description": "Cycle time in seconds when smart cook setting is 4",
                "x-parser-schema-id": "<anonymous-schema-197>"
              },
              "prop": {
                "type": "integer",
                "minimum": 10,
                "maximum": 50,
                "description": "Proportional band in degrees F when smart cook is 4",
                "x-parser-schema-id": "<anonymous-schema-198>"
              }
            },
            "required": [
              "name",
              "sc",
              "cyc",
              "prop"
            ],
            "example": {
              "name": "gpid",
              "sc": 2,
              "cyc": 5,
              "prop": 25
            },
            "x-parser-schema-id": "<anonymous-schema-194>"
          },
          "x-parser-unique-object-id": "gpid_down",
          "x-parser-message-name": "gpid_down"
        },
        "open_pit_down": {
          "tags": [
            {
              "name": "Fan Control"
            }
          ],
          "summary": "Set open pit configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "open_pit"
                ],
                "x-parser-schema-id": "<anonymous-schema-200>"
              },
              "max_pause": {
                "type": "integer",
                "description": "Max open pause time in seconds",
                "x-parser-schema-id": "<anonymous-schema-201>"
              }
            },
            "required": [
              "name",
              "max_pause"
            ],
            "example": {
              "name": "open_pit",
              "max_pause": 300
            },
            "x-parser-schema-id": "<anonymous-schema-199>"
          },
          "x-parser-unique-object-id": "open_pit_down",
          "x-parser-message-name": "open_pit_down"
        },
        "step_down": {
          "tags": [
            {
              "name": "Cooking"
            }
          ],
          "summary": "Set step configuration",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "step"
                ],
                "x-parser-schema-id": "<anonymous-schema-203>"
              },
              "index": {
                "type": "integer",
                "description": "0-based step",
                "x-parser-schema-id": "<anonymous-schema-204>"
              },
              "step_name": {
                "type": "string",
                "description": "Name of step",
                "x-parser-schema-id": "<anonymous-schema-205>"
              },
              "set_temp": {
                "type": "integer",
                "description": "Set temp to hold during this step",
                "x-parser-schema-id": "<anonymous-schema-206>"
              },
              "end_by": {
                "type": "string",
                "enum": [
                  "time",
                  "temp",
                  "none"
                ],
                "x-parser-schema-id": "<anonymous-schema-207>"
              },
              "time": {
                "type": "integer",
                "description": "Time this step lasts in seconds",
                "x-parser-schema-id": "<anonymous-schema-208>"
              },
              "temp": {
                "type": "integer",
                "description": "Target temp that causes to next step if end_by == temp",
                "x-parser-schema-id": "<anonymous-schema-209>"
              },
              "sensor": {
                "type": "integer",
                "description": "Sensor used for target temp if end_by = temp",
                "x-parser-schema-id": "<anonymous-schema-210>"
              }
            },
            "required": [
              "name",
              "index",
              "step_name",
              "set_temp",
              "end_by"
            ],
            "example": {
              "name": "step",
              "index": 0,
              "step_name": "Smoke",
              "set_temp": 225,
              "end_by": "time",
              "time": 7200
            },
            "x-parser-schema-id": "<anonymous-schema-202>"
          },
          "x-parser-unique-object-id": "step_down",
          "x-parser-message-name": "step_down"
        },
        "timer_down": {
          "tags": [
            {
              "name": "Cooking"
            }
          ],
          "summary": "Set timer configuration or request timer configuration and status",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "timer"
                ],
                "x-parser-schema-id": "<anonymous-schema-212>"
              },
              "action": {
                "type": "string",
                "enum": [
                  "none",
                  "hold",
                  "alarm"
                ],
                "description": "what to do when the timer expires. If hold, change the internal set temperature to the hold temperature.",
                "x-parser-schema-id": "<anonymous-schema-213>"
              },
              "value": {
                "type": "integer",
                "description": "start value of the timer in seconds",
                "x-parser-schema-id": "<anonymous-schema-214>"
              },
              "hold": {
                "type": "integer",
                "description": "the hold temperature",
                "x-parser-schema-id": "<anonymous-schema-215>"
              }
            },
            "required": [
              "name"
            ],
            "example": {
              "name": "timer",
              "action": "hold",
              "value": 14400,
              "hold": 656
            },
            "x-parser-schema-id": "<anonymous-schema-211>"
          },
          "x-parser-unique-object-id": "timer_down",
          "x-parser-message-name": "timer_down"
        },
        "state_down": {
          "tags": [
            {
              "name": "Device"
            }
          ],
          "summary": "Turns the cooker off (not supported on most targets because they do not have an on/off state)",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "state"
                ],
                "x-parser-schema-id": "<anonymous-schema-217>"
              },
              "value": {
                "type": "string",
                "enum": [
                  "idle"
                ],
                "x-parser-schema-id": "<anonymous-schema-218>"
              }
            },
            "required": [
              "name",
              "value"
            ],
            "example": {
              "name": "state",
              "value": "idle"
            },
            "x-parser-schema-id": "<anonymous-schema-216>"
          },
          "x-parser-unique-object-id": "state_down",
          "x-parser-message-name": "state_down"
        },
        "reset_down": {
          "tags": [
            {
              "name": "Device"
            }
          ],
          "summary": "Reset different levels of the device: the mqtt connection, the wifi connection, or the processor",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "reset"
                ],
                "x-parser-schema-id": "<anonymous-schema-220>"
              },
              "type": {
                "type": "string",
                "enum": [
                  "mqtt",
                  "wifi",
                  "device"
                ],
                "x-parser-schema-id": "<anonymous-schema-221>"
              }
            },
            "required": [
              "name",
              "type"
            ],
            "example": {
              "name": "reset",
              "type": "device"
            },
            "x-parser-schema-id": "<anonymous-schema-219>"
          },
          "x-parser-unique-object-id": "reset_down",
          "x-parser-message-name": "reset_down"
        },
        "log_down": {
          "tags": [
            {
              "name": "Device"
            }
          ],
          "summary": "Set the log level that is output on topic flameboss/<device_id>/log",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "log"
                ],
                "x-parser-schema-id": "<anonymous-schema-223>"
              },
              "level": {
                "type": "integer",
                "description": "0 = debug, 1 = info, 2 = warn, 3 = error",
                "x-parser-schema-id": "<anonymous-schema-224>"
              }
            },
            "required": [
              "name",
              "level"
            ],
            "example": {
              "name": "log",
              "level": 1
            },
            "x-parser-schema-id": "<anonymous-schema-222>"
          },
          "x-parser-unique-object-id": "log_down",
          "x-parser-message-name": "log_down"
        },
        "alarm_ack_down": {
          "tags": [
            {
              "name": "Alarms"
            }
          ],
          "summary": "Reset and silence any active alert including for pit alert, meat alert, or timer alert",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "alarm_ack"
                ],
                "x-parser-schema-id": "<anonymous-schema-226>"
              }
            },
            "required": [
              "name"
            ],
            "example": {
              "name": "alarm_ack"
            },
            "x-parser-schema-id": "<anonymous-schema-225>"
          },
          "x-parser-unique-object-id": "alarm_ack_down",
          "x-parser-message-name": "alarm_ack_down"
        },
        "sync_down": {
          "tags": [
            {
              "name": "Device"
            }
          ],
          "summary": "Request all settings and readings from the device",
          "payload": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "enum": [
                  "sync"
                ],
                "x-parser-schema-id": "<anonymous-schema-228>"
              }
            },
            "required": [
              "name"
            ],
            "example": {
              "name": "sync"
            },
            "x-parser-schema-id": "<anonymous-schema-227>"
          },
          "x-parser-unique-object-id": "sync_down",
          "x-parser-message-name": "sync_down"
        }
      },
      "x-parser-unique-object-id": "flameboss/{deviceId}/recv"
    }
  },
  "operations": {
    "temps uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/open.messages.temps_up"
      ],
      "tags": [
        {
          "name": "Cooking"
        }
      ],
      "x-parser-unique-object-id": "temps uplink"
    },
    "set_temp downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.set_temp_down"
      ],
      "tags": [
        {
          "name": "Cooking"
        }
      ],
      "x-parser-unique-object-id": "set_temp downlink"
    },
    "set_temp uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.set_temp_up"
      ],
      "tags": [
        {
          "name": "Cooking"
        }
      ],
      "x-parser-unique-object-id": "set_temp uplink"
    },
    "set_temp_limits uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.set_temp_limits_up"
      ],
      "tags": [
        {
          "name": "Cooking"
        }
      ],
      "x-parser-unique-object-id": "set_temp_limits uplink"
    },
    "step uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.step_up"
      ],
      "tags": [
        {
          "name": "Cooking"
        }
      ],
      "x-parser-unique-object-id": "step uplink"
    },
    "step downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.step_down"
      ],
      "tags": [
        {
          "name": "Cooking"
        }
      ],
      "x-parser-unique-object-id": "step downlink"
    },
    "timer uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.timer_up"
      ],
      "tags": [
        {
          "name": "Cooking"
        }
      ],
      "x-parser-unique-object-id": "timer uplink"
    },
    "timer downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.timer_down"
      ],
      "tags": [
        {
          "name": "Cooking"
        }
      ],
      "x-parser-unique-object-id": "timer downlink"
    },
    "labels uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.labels_up"
      ],
      "tags": [
        {
          "name": "Cooking"
        }
      ],
      "x-parser-unique-object-id": "labels uplink"
    },
    "labels downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.labels_down"
      ],
      "tags": [
        {
          "name": "Cooking"
        }
      ],
      "x-parser-unique-object-id": "labels downlink"
    },
    "meat_alarm uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.meat_alarm_up"
      ],
      "tags": [
        {
          "name": "Alarms"
        }
      ],
      "x-parser-unique-object-id": "meat_alarm uplink"
    },
    "meat_alarm downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.meat_alarm_down"
      ],
      "tags": [
        {
          "name": "Alarms"
        }
      ],
      "x-parser-unique-object-id": "meat_alarm downlink"
    },
    "pit_alarm uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.pit_alarm_up"
      ],
      "tags": [
        {
          "name": "Alarms"
        }
      ],
      "x-parser-unique-object-id": "pit_alarm uplink"
    },
    "pit_alarm downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.pit_alarm_down"
      ],
      "tags": [
        {
          "name": "Alarms"
        }
      ],
      "x-parser-unique-object-id": "pit_alarm downlink"
    },
    "alarm_ack downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.alarm_ack_down"
      ],
      "tags": [
        {
          "name": "Alarms"
        }
      ],
      "x-parser-unique-object-id": "alarm_ack downlink"
    },
    "meat_alarm_triggered uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.meat_alarm_triggered_up"
      ],
      "tags": [
        {
          "name": "Alarms"
        }
      ],
      "x-parser-unique-object-id": "meat_alarm_triggered uplink"
    },
    "pit_alarm_active uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.pit_alarm_active_up"
      ],
      "tags": [
        {
          "name": "Alarms"
        }
      ],
      "x-parser-unique-object-id": "pit_alarm_active uplink"
    },
    "pit_alarm_triggered uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.pit_alarm_triggered_up"
      ],
      "tags": [
        {
          "name": "Alarms"
        }
      ],
      "x-parser-unique-object-id": "pit_alarm_triggered uplink"
    },
    "vent_advice uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.vent_advice_up"
      ],
      "tags": [
        {
          "name": "Alarms"
        }
      ],
      "x-parser-unique-object-id": "vent_advice uplink"
    },
    "probe_overtemp uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.probe_overtemp_up"
      ],
      "tags": [
        {
          "name": "Alarms"
        }
      ],
      "x-parser-unique-object-id": "probe_overtemp uplink"
    },
    "device_overtemp uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.device_overtemp_up"
      ],
      "tags": [
        {
          "name": "Alarms"
        }
      ],
      "x-parser-unique-object-id": "device_overtemp uplink"
    },
    "pid uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.pid_up"
      ],
      "tags": [
        {
          "name": "Fan Control"
        }
      ],
      "x-parser-unique-object-id": "pid uplink"
    },
    "pid downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.pid_down"
      ],
      "tags": [
        {
          "name": "Fan Control"
        }
      ],
      "x-parser-unique-object-id": "pid downlink"
    },
    "gpid uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.gpid_up"
      ],
      "tags": [
        {
          "name": "Fan Control"
        }
      ],
      "x-parser-unique-object-id": "gpid uplink"
    },
    "gpid downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.gpid_down"
      ],
      "tags": [
        {
          "name": "Fan Control"
        }
      ],
      "x-parser-unique-object-id": "gpid downlink"
    },
    "open_pit uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.open_pit_up"
      ],
      "tags": [
        {
          "name": "Fan Control"
        }
      ],
      "x-parser-unique-object-id": "open_pit uplink"
    },
    "open_pit downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.open_pit_down"
      ],
      "tags": [
        {
          "name": "Fan Control"
        }
      ],
      "x-parser-unique-object-id": "open_pit downlink"
    },
    "wifi uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.wifi_up"
      ],
      "tags": [
        {
          "name": "Network"
        }
      ],
      "x-parser-unique-object-id": "wifi uplink"
    },
    "wifi downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.wifi_down"
      ],
      "tags": [
        {
          "name": "Network"
        }
      ],
      "x-parser-unique-object-id": "wifi downlink"
    },
    "wifi_cx uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.wifi_cx_up"
      ],
      "tags": [
        {
          "name": "Network"
        }
      ],
      "x-parser-unique-object-id": "wifi_cx uplink"
    },
    "wifi_scan uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.wifi_scan_up"
      ],
      "tags": [
        {
          "name": "Network"
        }
      ],
      "x-parser-unique-object-id": "wifi_scan uplink"
    },
    "wifi_scan downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.wifi_scan_down"
      ],
      "tags": [
        {
          "name": "Network"
        }
      ],
      "x-parser-unique-object-id": "wifi_scan downlink"
    },
    "ble_cx uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.ble_cx_up"
      ],
      "tags": [
        {
          "name": "Network"
        }
      ],
      "x-parser-unique-object-id": "ble_cx uplink"
    },
    "ble_cx downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.ble_cx_down"
      ],
      "tags": [
        {
          "name": "Network"
        }
      ],
      "x-parser-unique-object-id": "ble_cx downlink"
    },
    "ip uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.ip_up"
      ],
      "tags": [
        {
          "name": "Network"
        }
      ],
      "x-parser-unique-object-id": "ip uplink"
    },
    "ip downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.ip_down"
      ],
      "tags": [
        {
          "name": "Network"
        }
      ],
      "x-parser-unique-object-id": "ip downlink"
    },
    "dns uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.dns_up"
      ],
      "tags": [
        {
          "name": "Network"
        }
      ],
      "x-parser-unique-object-id": "dns uplink"
    },
    "dns downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.dns_down"
      ],
      "tags": [
        {
          "name": "Network"
        }
      ],
      "x-parser-unique-object-id": "dns downlink"
    },
    "id uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.id_up"
      ],
      "tags": [
        {
          "name": "Device"
        }
      ],
      "x-parser-unique-object-id": "id uplink"
    },
    "id downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.id_down"
      ],
      "tags": [
        {
          "name": "Device"
        }
      ],
      "x-parser-unique-object-id": "id downlink"
    },
    "time uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/open.messages.time_up"
      ],
      "tags": [
        {
          "name": "Device"
        }
      ],
      "x-parser-unique-object-id": "time uplink"
    },
    "time downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.time_down"
      ],
      "tags": [
        {
          "name": "Device"
        }
      ],
      "x-parser-unique-object-id": "time downlink"
    },
    "state uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.state_up"
      ],
      "tags": [
        {
          "name": "Device"
        }
      ],
      "x-parser-unique-object-id": "state uplink"
    },
    "state downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.state_down"
      ],
      "tags": [
        {
          "name": "Device"
        }
      ],
      "x-parser-unique-object-id": "state downlink"
    },
    "sound uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.sound_up"
      ],
      "tags": [
        {
          "name": "Device"
        }
      ],
      "x-parser-unique-object-id": "sound uplink"
    },
    "sound downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.sound_down"
      ],
      "tags": [
        {
          "name": "Device"
        }
      ],
      "x-parser-unique-object-id": "sound downlink"
    },
    "reset downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.reset_down"
      ],
      "tags": [
        {
          "name": "Device"
        }
      ],
      "x-parser-unique-object-id": "reset downlink"
    },
    "log downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.log_down"
      ],
      "tags": [
        {
          "name": "Device"
        }
      ],
      "x-parser-unique-object-id": "log downlink"
    },
    "device_temp uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.device_temp_up"
      ],
      "tags": [
        {
          "name": "Device"
        }
      ],
      "x-parser-unique-object-id": "device_temp uplink"
    },
    "dc_input uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.dc_input_up"
      ],
      "tags": [
        {
          "name": "Device"
        }
      ],
      "x-parser-unique-object-id": "dc_input uplink"
    },
    "sync downlink": {
      "action": "send",
      "channel": "$ref:$.channels.flameboss/{deviceId}/recv",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/recv.messages.sync_down"
      ],
      "tags": [
        {
          "name": "Device"
        }
      ],
      "x-parser-unique-object-id": "sync downlink"
    },
    "opened uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.opened_up"
      ],
      "tags": [
        {
          "name": "Deprecated"
        }
      ],
      "x-parser-unique-object-id": "opened uplink"
    },
    "closed uplink": {
      "action": "receive",
      "channel": "$ref:$.channels.flameboss/{deviceId}/send/data",
      "messages": [
        "$ref:$.channels.flameboss/{deviceId}/send/data.messages.closed_up"
      ],
      "tags": [
        {
          "name": "Deprecated"
        }
      ],
      "x-parser-unique-object-id": "closed uplink"
    }
  },
  "components": {
    "messages": {
      "sync_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.sync_down",
      "alarm_ack_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.alarm_ack_down",
      "id_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.id_up",
      "id_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.id_down",
      "time_up": "$ref:$.channels.flameboss/{deviceId}/send/open.messages.time_up",
      "time_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.time_down",
      "dns_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.dns_up",
      "dns_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.dns_down",
      "ip_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.ip_up",
      "ip_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.ip_down",
      "temps_up": "$ref:$.channels.flameboss/{deviceId}/send/open.messages.temps_up",
      "set_temp_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.set_temp_up",
      "set_temp_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.set_temp_down",
      "wifi_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.wifi_up",
      "wifi_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.wifi_down",
      "wifi_cx_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.wifi_cx_up",
      "ble_cx_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.ble_cx_up",
      "ble_cx_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.ble_cx_down",
      "meat_alarm_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.meat_alarm_up",
      "meat_alarm_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.meat_alarm_down",
      "set_temp_limits_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.set_temp_limits_up",
      "pit_alarm_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.pit_alarm_up",
      "pit_alarm_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.pit_alarm_down",
      "labels_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.labels_up",
      "labels_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.labels_down",
      "sound_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.sound_up",
      "sound_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.sound_down",
      "pid_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.pid_up",
      "pid_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.pid_down",
      "gpid_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.gpid_up",
      "gpid_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.gpid_down",
      "open_pit_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.open_pit_up",
      "open_pit_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.open_pit_down",
      "step_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.step_up",
      "step_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.step_down",
      "device_temp_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.device_temp_up",
      "dc_input_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.dc_input_up",
      "meat_alarm_triggered_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.meat_alarm_triggered_up",
      "pit_alarm_active_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.pit_alarm_active_up",
      "pit_alarm_triggered_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.pit_alarm_triggered_up",
      "vent_advice_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.vent_advice_up",
      "opened_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.opened_up",
      "closed_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.closed_up",
      "probe_overtemp_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.probe_overtemp_up",
      "device_overtemp_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.device_overtemp_up",
      "wifi_scan_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.wifi_scan_up",
      "wifi_scan_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.wifi_scan_down",
      "timer_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.timer_up",
      "timer_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.timer_down",
      "reset_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.reset_down",
      "log_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.log_down",
      "state_down": "$ref:$.channels.flameboss/{deviceId}/recv.messages.state_down",
      "state_up": "$ref:$.channels.flameboss/{deviceId}/send/data.messages.state_up"
    }
  },
  "x-parser-spec-parsed": true,
  "x-parser-api-version": 3,
  "x-parser-spec-stringified": true
};
    const config = {"show":{"sidebar":true},"sidebar":{"showOperations":"byOperationsTags"}};
    const appRoot = document.getElementById('root');
    AsyncApiStandalone.render(
        { schema, config, }, appRoot
    );
  