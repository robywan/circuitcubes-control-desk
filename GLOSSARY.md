# CircuitCubes Control Desk

A browser control desk for driving motorised LEGO locomotives powered by Circuit Cubes, using a LEGO Powered Up remote as the physical controller.

## Language

### Hardware

**Locomotive**:
A motorised LEGO train engine powered by a single Battery Cube; a Locomotive with several motors is still one Locomotive.
_Avoid_: Train, loco

**Battery Cube**:
The Circuit Cubes Bluetooth Battery Cube that powers a Locomotive's motors.
_Avoid_: Circuit Cube, hub

**Battery voltage**:
The voltage of a Battery Cube's internal battery, as reported by the Battery Cube itself.
_Avoid_: Battery level, charge, livello batteria

**Channel**:
One of the three motor outputs (A, B, C) of a Battery Cube.
_Avoid_: Port, output

**Remote**:
The LEGO Powered Up Remote (88010) used as the physical controller.
_Avoid_: Controller, pad

### Driving

**Speed step**:
One of the discrete speed levels a Locomotive can be set to: positive is forward, negative is reverse, zero is stopped.
_Avoid_: Gear, notch, throttle, marcia

**Power**:
The 0–255 output level a Battery Cube applies to a Channel.
_Avoid_: Speed, PWM

**Inertia**:
The gradual change of the Power towards the Power of the current Speed step, the same when accelerating and when braking.
_Avoid_: Momentum, ramp, rampa
