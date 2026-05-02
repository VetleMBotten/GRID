#include <Arduino.h>
#include <NimBLEDevice.h>
#include <WiFi.h>
#include <WiFiUdp.h>

// ===== KONFIG =====
const char* ssid     = "mikroplast";
const char* password = "mikroplast";

// IP-adressen til PC/gateway (endre hvis nødvendig)
IPAddress pcIp(192, 168, 137, 1);
const uint16_t UDP_PORT = 4444;

// ID for denne staven (SETT ULIKT FOR HVER ESP32!)
static const int NODE_ID = 2;

static const char* TARGET_UUID[] ={
  "c0de1234-0000-4000-8000-000000000001",
  "c0de1234-0000-4000-8000-000000000002",
  "c0de1234-0000-4000-8000-000000000003",
  "c0de1234-0000-4000-8000-000000000004"
};

static const int NUM_UUID = sizeof(TARGET_UUID)/sizeof(TARGET_UUID[0]);

static const int RSSI_ENTER = -200;   // teller når vi går inn
static const int RSSI_EXIT  = -180;   // frigir ny telling
static const uint32_t COOLDOWN_MS = 800; //800

// ===== STATE =====
uint32_t lastSeenMs = 0;
bool inRange = false;
uint32_t passCount = 0;

WiFiUDP udp;
NimBLEScan* scan = nullptr;

int matchesTargetUuid(const NimBLEAdvertisedDevice* dev) {
  for (int i = 0; i < NUM_UUID; i++) {
    if (dev->isAdvertisingService(NimBLEUUID(TARGET_UUID[i]))) {
      return i;
    }
  }
  return -1;
}

// ===== BLE CALLBACK =====
class MyScanCallbacks : public NimBLEScanCallbacks {
  void onResult(const NimBLEAdvertisedDevice* dev) override {
    int unitID = matchesTargetUuid(dev);

    if (unitID == -1) return;

    int rssi = dev->getRSSI();
    uint32_t now = millis();
    lastSeenMs = now;

    // ---- INN ----
    if (rssi >= RSSI_ENTER) { //!inRange && 
      inRange = true;
      passCount++;

      // Serial debug (viktig!)
      Serial.print("PASSERING #");
      Serial.print(passCount);
      Serial.print("  RSSI=");
      Serial.print(rssi);
      Serial.print("  ID:");
      Serial.print(unitID);
      Serial.print(" dBm  Addr=");
      Serial.println(dev->getAddress().toString().c_str());

      // ---- UDP SEND ----
      if (WiFi.status() == WL_CONNECTED) {
        char msg[160];
        snprintf(
          msg, sizeof(msg),
          "{\"node\":%d,\"count\":%lu,\"rssi\":%d,\"unit\":%d,\"ts\":%lu}",
          NODE_ID,
          (unsigned long)passCount,
          rssi,
          unitID,
          (unsigned long)now
        );

        udp.beginPacket(pcIp, UDP_PORT);
        udp.write((const uint8_t*)msg, strlen(msg));
        udp.endPacket();
      }
    }

    // ---- UT ----
    if (inRange && rssi <= RSSI_EXIT) {
      //Serial.print("exit");
      inRange = false;
    }
  }
};

void setup() {
  Serial.begin(115200);
  delay(1000);

  // ---- WiFi ----
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);   // viktig når BLE er på
  WiFi.begin(ssid, password);

  Serial.print("Kobler til WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(200);
  }

  Serial.println("\nWiFi tilkoblet");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());

  udp.begin(UDP_PORT);

  // ---- BLE (NimBLE 2.x) ----
  Serial.println("Starter NimBLE scan...");

  NimBLEDevice::init("");
  NimBLEDevice::setPower(ESP_PWR_LVL_P6);

  scan = NimBLEDevice::getScan();

  static MyScanCallbacks callbacks;
  scan->setScanCallbacks(&callbacks, /*wantDuplicates=*/true);

  scan->setActiveScan(false);
  scan->setInterval(120);
  scan->setWindow(60);

  // kontinuerlig scanning
  scan->start(0, true, true);

  Serial.println("Scanner kontinuerlig...");
}

void loop() {
  // fallback: frigir hvis beaconen blir helt borte
  if (inRange && millis() - lastSeenMs > COOLDOWN_MS) {
    //Serial.print("cooldown");
    inRange = false;
  }

  delay(10);
}