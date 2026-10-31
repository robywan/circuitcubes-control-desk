# Web Bluetooth

Fatti sulla piattaforma Web Bluetooth che valgono per qualunque dispositivo, sia il Battery Cube sia il Remote. Vocabolario in `GLOSSARY.md`.

## Operazioni GATT concorrenti

Domanda: un'app può avviare un'operazione GATT (scrittura, lettura, attivazione delle notifiche) mentre la precedente sullo stesso dispositivo è ancora in corso?

Ricerca del 2026-10-31. Risposta: no. La specifica permette al browser di rifiutarla e Chromium lo fa, quindi l'app deve serializzare le operazioni.

### Fonti

- **SPEC**: [Web Bluetooth](https://bluetooth.spec.whatwg.org/), il draft a cui ora rimanda `webbluetoothcg.github.io/web-bluetooth`.
- **ISSUE**: [whatwg/bluetooth#188](https://github.com/whatwg/bluetooth/issues/188), "GATT operation in progress - how to handle it?", aperta dal 2015.
- **CHR**: [chromium/chromium](https://github.com/chromium/chromium/tree/7a3c8d1b05ccf31dc16b9ad3f88720485e0cddf6), link fissati a un commit.
- **AOSP**: [`BluetoothGatt.java`](https://android.googlesource.com/platform/packages/modules/Bluetooth/+/refs/heads/main/framework/java/android/bluetooth/BluetoothGatt.java), ramo `main` al 2026-10-31.

### Specifica

- Sei algoritmi contengono la stessa clausola: "If the UA is currently using the Bluetooth system, it MAY […] reject promise with a "NetworkError" DOMException". Sono [`connect()`](https://bluetooth.spec.whatwg.org/#dom-bluetoothremotegattserver-connect), [`readValue()` della caratteristica](https://bluetooth.spec.whatwg.org/#dom-bluetoothremotegattcharacteristic-readvalue), [WriteCharacteristicValue](https://bluetooth.spec.whatwg.org/#writecharacteristicvalue), [`startNotifications()`](https://bluetooth.spec.whatwg.org/#dom-bluetoothremotegattcharacteristic-startnotifications) e [`readValue()`](https://bluetooth.spec.whatwg.org/#dom-bluetoothremotegattdescriptor-readvalue) e [`writeValue()`](https://bluetooth.spec.whatwg.org/#dom-bluetoothremotegattdescriptor-writevalue) del descrittore. WriteCharacteristicValue è l'algoritmo di `writeValue()`, `writeValueWithResponse()` e `writeValueWithoutResponse()`.
- Subito dopo, nell'algoritmo di scrittura: "Implementations may be able to avoid this NetworkError, but for now sites need to serialize their use of this API and/or give the user a way to retry failed operations" ([SPEC, WriteCharacteristicValue](https://bluetooth.spec.whatwg.org/#writecharacteristicvalue)).
- Se debba essere il browser a mettere in coda le operazioni è ancora in discussione ([ISSUE](https://github.com/whatwg/bluetooth/issues/188)).

### Chromium

- Chromium rifiuta, non accoda. Una lettura o una scrittura su una caratteristica che ha già una lettura o una scrittura in corso fallisce con `kInProgress`:
  - Android: [`bluetooth_remote_gatt_characteristic_android.cc` L158-162](https://github.com/chromium/chromium/blob/7a3c8d1b05ccf31dc16b9ad3f88720485e0cddf6/device/bluetooth/bluetooth_remote_gatt_characteristic_android.cc#L158-L162);
  - macOS: [`bluetooth_remote_gatt_characteristic_mac.mm` L167-172](https://github.com/chromium/chromium/blob/7a3c8d1b05ccf31dc16b9ad3f88720485e0cddf6/device/bluetooth/bluetooth_remote_gatt_characteristic_mac.mm#L167-L172);
  - Windows: [`bluetooth_remote_gatt_characteristic_winrt.cc` L215-220](https://github.com/chromium/chromium/blob/7a3c8d1b05ccf31dc16b9ad3f88720485e0cddf6/device/bluetooth/bluetooth_remote_gatt_characteristic_winrt.cc#L215-L220);
  - Linux e ChromeOS: l'errore `InProgress` di BlueZ diventa `kInProgress` ([`bluetooth_gatt_service_bluez.cc` L33-34](https://github.com/chromium/chromium/blob/7a3c8d1b05ccf31dc16b9ad3f88720485e0cddf6/device/bluetooth/bluez/bluetooth_gatt_service_bluez.cc#L33-L34)), e lo stesso vale per lo stato "busy" di Floss ([`bluetooth_remote_gatt_characteristic_floss.cc` L268-271](https://github.com/chromium/chromium/blob/7a3c8d1b05ccf31dc16b9ad3f88720485e0cddf6/device/bluetooth/floss/bluetooth_remote_gatt_characteristic_floss.cc#L268-L271)).
- La pagina riceve `kInProgress` come `NetworkError` con il messaggio "GATT operation already in progress." ([`web_bluetooth_service_impl.cc` L103-106](https://github.com/chromium/chromium/blob/7a3c8d1b05ccf31dc16b9ad3f88720485e0cddf6/content/browser/bluetooth/web_bluetooth_service_impl.cc#L103-L106), [`bluetooth_error.cc` L144-145](https://github.com/chromium/chromium/blob/7a3c8d1b05ccf31dc16b9ad3f88720485e0cddf6/third_party/blink/renderer/modules/bluetooth/bluetooth_error.cc#L144-L145)).

### Android

- Android accetta una sola operazione GATT alla volta per connessione, non per caratteristica. `readCharacteristic`, `writeCharacteristic` e `writeDescriptor` rifiutano la richiesta finché il flag `mDeviceBusy` è attivo ([AOSP](https://android.googlesource.com/platform/packages/modules/Bluetooth/+/refs/heads/main/framework/java/android/bluetooth/BluetoothGatt.java)). Su Android quindi collidono anche due operazioni su caratteristiche diverse dello stesso dispositivo, per esempio una scrittura e l'attivazione delle notifiche su un'altra caratteristica.
- Chromium inoltra la scrittura a `writeCharacteristic` di Android ([`ChromeBluetoothRemoteGattCharacteristic.java` L142-152](https://github.com/chromium/chromium/blob/7a3c8d1b05ccf31dc16b9ad3f88720485e0cddf6/device/bluetooth/android/java/src/org/chromium/device/bluetooth/ChromeBluetoothRemoteGattCharacteristic.java#L142-L152)). Se Android la rifiuta, l'errore è `kFailed` ([`bluetooth_remote_gatt_characteristic_android.cc` L176-183](https://github.com/chromium/chromium/blob/7a3c8d1b05ccf31dc16b9ad3f88720485e0cddf6/device/bluetooth/bluetooth_remote_gatt_characteristic_android.cc#L176-L183)). La pagina lo riceve come `NotSupportedError` con il messaggio "GATT operation failed for unknown reason." ([`bluetooth_error.cc` L187-188](https://github.com/chromium/chromium/blob/7a3c8d1b05ccf31dc16b9ad3f88720485e0cddf6/third_party/blink/renderer/modules/bluetooth/bluetooth_error.cc#L187-L188)), non come `NetworkError`.

### Conseguenza per l'app

Su ogni dispositivo si avvia un'operazione GATT solo dopo che la promessa della precedente si è risolta o è stata rifiutata. Questo vale anche per `startNotifications()` e per caratteristiche diverse. Il modo più semplice è una coda per dispositivo.

### Domande aperte

- Se due dispositivi diversi possono collidere. La specifica lo permette ("currently using the Bluetooth system"), ma nel codice di Chromium esaminato i controlli sono per caratteristica e, su Android, per connessione.
- Per quanto tempo una scrittura senza risposta tiene occupata la connessione su Android.
