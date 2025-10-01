<script lang="ts">
  import { onMount } from "svelte";

  export let x: number = 0;          // explosion center X
  export let y: number = 0;          // explosion center Y
  export let size: number = 40;      // blast circle size
  export let particles: number = 64;  // number of dots
  export let duration: number = 600; // ms
  export let spread: number = 480;   // how far the particles fly

  let show = true;

  onMount(() => setTimeout(() => (show = false), duration));

  function randomDirection() {
    return { x: Math.random(), y: Math.random() };
  }

  const dirs = Array.from({ length: particles }, () => randomDirection());
</script>

{#if show}
<div class="absolute pointer-events-none"
     style="left: {x - size / 2}%; top: {y - size / 2}%; width: {size}%; height: {size}%;">
  <!-- Blast circle -->
  <div class="absolute w-full h-full rounded-full bg-yellow-200/20 animate-ping"></div>

  <!-- Explosion particles -->
  {#each dirs as dir, i (i)}
    <div
      class="particle"
      style="
        --x: {dir.x};
        --y: {dir.y};
        --spread: {spread}px;
        background: {i % 2 === 0 ? 'grey' : 'white'};
      "
    ></div>
  {/each}
</div>
{/if}

<style>
  .particle {
    position: absolute;
    width: 3px;
    height: 3px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    animation: explode 0.6s ease-out forwards;
  }

  @keyframes explode {
    to {
      opacity: 0;
      transform: translate(
        calc(-50% + (var(--x) - 0.5) * var(--spread, 120px)),
        calc(-50% + (var(--y) - 0.5) * var(--spread, 120px))
      );
    }
  }
</style>
