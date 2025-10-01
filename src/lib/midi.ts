export async function initMIDI(onMessage: (message: Uint8Array) => void) {
  if (!navigator.requestMIDIAccess) {
    console.error("Web MIDI API not supported in this browser.");
    return null;
  }

  const access = await navigator.requestMIDIAccess();

  // Listen to all MIDI inputs
  for (const input of access.inputs.values()) {
    input.onmidimessage = (event) => {
      onMessage(event.data);
    };
  }

  return access;
}
