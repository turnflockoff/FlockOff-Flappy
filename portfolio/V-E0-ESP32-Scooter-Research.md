# V-E0 Shared-Ride Scooter Electronics — ESP32 Dashboard Research

**Project date:**  
**Project owner:** TurnFlockOff  
**Status:** Independent research and conceptual design — not a validated retrofit  
**Project codename:** V-E0

> **Independence and naming:** “V-E0” is a neutral project codename for the photographed shared-ride scooter/e-bike hardware. This project does not claim affiliation, sponsorship, endorsement, or authorization by any manufacturer or operator. A codename does not itself eliminate trademark or other legal risk.

## Project summary

This project documents a visual investigation of a shared-ride scooter/e-bike display and control electronics assembly, then explores whether selected dashboard and communications functions could eventually be handled by an independent ESP32-based board.

The work combines original hardware photographs, a connector-label inventory, PCB-marking observations, battery-label transcription, conceptual wiring diagrams, and ESP32 replacement-board illustrations. The central engineering question is whether a separate low-voltage dashboard/interface can be developed without disturbing the traction controller or safety-critical vehicle functions.

## Hypothesis / reasoning

The original display/control assembly may combine several separable functions: user display, low-voltage power regulation, external I/O, serial communications, and cellular/GPS-related hardware. If the actual connector pin functions, electrical levels, protocols, battery limits, and mechanical dimensions can be measured, an independent ESP32-S3 dashboard/interface may be feasible.

This is a hypothesis, not a verified finding. The available material does not establish a confirmed OEM architecture or a compatible drop-in replacement.

## What I did

- Organized a recovered evidence collection of **43 unique original hardware/document photographs** and **9 engineering-artwork images**.
- Reviewed photographs of the enclosure, multi-board electronics assembly, connector panel, PCB surfaces, and battery label.
- Recorded the nine connector-panel labels visible in the photo set: USB DEBUG, BRAKE, THROTTLE, SPEAKER, LED, DATA, 5V OUTPUT, 12V OUTPUT, and FRONT LIGHT.
- Transcribed visible PCB identifiers and silkscreen/test labels where legible, including references to BMS-TX, BMS-RX, MCU-TX, MCU-RX, 3V3, GND, and 12V.
- Documented the battery-label values that are visibly readable: 46.8 V, 15 Ah, and 702 Wh, while flagging an unclear series/parallel marking for verification.
- Developed conceptual system diagrams and an ESP32-S3 replacement-dashboard architecture.
- Prepared two 3D-style engineering illustrations: a board-only replacement PCB concept and an exploded enclosure/board assembly concept.

## How I did it

The investigation used visual inspection of supplied photographs, transcription of visible labels, evidence organization, subsystem mapping, and conceptual engineering illustration. Candidate functions were grouped into power, display, communications, sensor/input, and lighting/audio interfaces.

The illustrations communicate design intent and identify measurements still needed. They are not substitutes for electrical testing, CAD measurement, datasheets, or manufacturing documentation.

## What happened / observed result

The available evidence supports a structured research hypothesis and a preliminary design direction:

- The photographs show a multi-board display/control assembly and a connector panel with nine functional labels.
- Visible PCB labels suggest multiple power and signal domains, but they do not establish pin-level electrical behavior.
- The battery label photograph visibly indicates 46.8 V / 15 Ah / 702 Wh; the smaller configuration marking remains unclear and must be confirmed.
- A plausible ESP32-S3 dashboard/interface architecture was outlined.
- Conceptual PCB and enclosure illustrations were produced to guide future measurement and CAD work.

**What has not been demonstrated:** no verified connector pinout, measured voltage table, decoded communications protocol, completed KiCad schematic, manufacturing-ready PCB, firmware integration, fabricated replacement board, successful bench test, or powered vehicle test is claimed.

## Concept-art and CAD disclaimer

All generated wiring diagrams, exploded views, 3D renders, PCB illustrations, component placements, connector geometries, and depicted dimensions are **conceptual illustrations only**. They are not measured CAD models, verified mechanical assemblies, validated electrical schematics, manufacturing-ready PCB files, Gerbers, or fabrication instructions.

Any dimensions shown in a render are placeholders unless independently measured and recorded. Do not use a render or conceptual diagram to wire or power a live vehicle.

## What I would change next

1. Photograph both sides of each board square-on with a scale and preserve original filenames/metadata.
2. Confirm the battery chemistry, series count, BMS limits, and maximum charge voltage from authoritative pack documentation.
3. Identify the exact motor controller and its permitted battery-voltage range.
4. Measure board/enclosure geometry, mounting points, connector positions, and component clearances with calipers.
5. Build a connector breakout and record pin orientation, continuity, voltage, polarity, and signal levels using suitable isolated/current-limited test equipment.
6. Capture communications passively before attempting any interface.
7. Create a measured KiCad schematic and PCB layout with actual footprints and design-rule checks.
8. Start with a low-voltage, non-invasive bench prototype. Do not command throttle, braking, or traction.
9. Keep rental locks, payment controls, geofencing, fleet-management systems, and safety interlocks outside the scope of this work.

## Evidence and reproducibility

The detailed research record and image inventory are maintained in the companion repository:

- [Technical research repository](https://github.com/turnflockoff/Iot-oev-rideshare-reverse-recycled-cosmo-scooter-e-bike-ESP32-custom-schematic-proof-work-draft-beta)
- [Proof-of-work log](https://github.com/turnflockoff/Iot-oev-rideshare-reverse-recycled-cosmo-scooter-e-bike-ESP32-custom-schematic-proof-work-draft-beta/blob/main/docs/PROOF_OF_WORK.md)
- [Image register](https://github.com/turnflockoff/Iot-oev-rideshare-reverse-recycled-cosmo-scooter-e-bike-ESP32-custom-schematic-proof-work-draft-beta/blob/main/evidence/IMAGE_REGISTER.md)

The current GitHub image register records the 52-image collection; the original binary images are not yet committed to that repository. The collection ZIP is maintained separately for upload.

## Reviewer note

This case study is intentionally conservative. It demonstrates evidence organization, hardware observation, hypothesis formation, system decomposition, conceptual interface design, and explicit identification of unknowns. It does not present conceptual artwork as completed engineering or claim a successful hardware retrofit.
