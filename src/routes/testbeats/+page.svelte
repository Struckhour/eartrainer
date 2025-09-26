<script lang="ts">
  let Tone: any;
  let beatLoop: any;
  let kick: any;
  let beatOn = false;
  let paused = false;

  async function startBeat() {
    if (!Tone) Tone = await import("tone");
    await Tone.start();
    console.log("AudioContext started");

    if (!kick) kick = new Tone.MembraneSynth().toDestination();

    if (!beatLoop) {
      beatLoop = new Tone.Loop((time: number) => {
        kick.triggerAttackRelease("C2", "8n", time);
        console.log(time);
      }, "4n");
      beatLoop.start(0);
    }

    Tone.Transport.start();
    beatOn = true;
    paused = false;
    console.log("Beat started");
  }

  function pauseBeat() {
    Tone.Transport.pause();
    paused = true;
    console.log("Beat paused");
  }

  function stopBeat() {
    if (beatLoop) {
      beatLoop.stop();
      beatLoop.dispose();
      beatLoop = null;
    }
    if (kick) {
      kick.dispose();
      kick = null;
    }
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    beatOn = false;
    paused = false;
    console.log("Beat stopped");
  }
</script>

{#if !beatOn}
  <button on:click={startBeat} class="mx-auto block py-1 px-2 mt-8 rounded-lg bg-blue-600 text-slate-200 text-2xl">Start</button>
{:else if paused}
  <button on:click={startBeat} class="mx-auto block py-1 px-2 mt-8 rounded-lg bg-green-600 text-slate-200 text-2xl">Resume</button>
  <button on:click={stopBeat} class="mx-auto block py-1 px-2 mt-2 rounded-lg bg-red-600 text-slate-200 text-2xl">Reset</button>
{:else}
  <button on:click={pauseBeat} class="mx-auto block py-1 px-2 mt-8 rounded-lg bg-yellow-600 text-slate-800 text-2xl">Pause</button>
  <!-- <button on:click={stopBeat} class="mx-auto block py-1 px-2 mt-2 rounded-lg bg-red-600 text-slate-200 text-2xl">Stop</button> -->
{/if}
