<script lang="ts">
  // Le texte d'un bloc, mis en forme et modifiable directement (titres, gras, listes…), enregistré en Markdown.
  // Ce que l'éditeur ne sait pas garder (tableau, image, HTML, en-tête YAML, cases à cocher) ouvre le texte brut, pour ne rien perdre.
  import { Editor } from "@tiptap/core";
  import { Markdown } from "@tiptap/markdown";
  import StarterKit from "@tiptap/starter-kit";
  import { onDestroy, onMount } from "svelte";

  let { texte, onchange }: { texte: string; onchange: (md: string, modifie: boolean) => void } = $props();

  const NON_GARDE = [/^\s*\|.*\|\s*$/m, /^---\s*\n/, /<\/?[a-z][^>]*>/i, /!\[[^\]]*\]\(/, /^\s*[-*] \[[ x]\]/im, /\[\^[^\]]+\]/];
  // svelte-ignore state_referenced_locally
  const brutObligatoire = NON_GARDE.some((r) => r.test(texte));
  // svelte-ignore state_referenced_locally
  let brut = $state(brutObligatoire);
  // svelte-ignore state_referenced_locally
  let source = $state(texte);
  let zone = $state<HTMLDivElement>();
  let editeur = $state<Editor | null>(null);
  let depart = "";
  let tic = $state(0);

  function creer(): void {
    if (!zone || editeur) return;
    editeur = new Editor({
      element: zone,
      extensions: [StarterKit.configure({ link: { openOnClick: false } }), Markdown],
      content: source,
      contentType: "markdown",
      onUpdate: ({ editor }) => {
        const md = editor.getMarkdown();
        onchange(md, md !== depart);
      },
      onTransaction: () => tic++,
    });
    depart = editeur.getMarkdown();
  }
  function detruire(): void {
    editeur?.destroy();
    editeur = null;
  }
  onMount(() => {
    if (!brut) creer();
  });
  onDestroy(detruire);

  function basculer(): void {
    if (brut) {
      brut = false;
      setTimeout(creer);
    } else {
      source = editeur?.getMarkdown() ?? source;
      detruire();
      brut = true;
    }
  }

  const actif = (nom: string, attrs?: Record<string, unknown>) => (void tic, editeur?.isActive(nom, attrs) ?? false);
  const chaine = () => editeur!.chain().focus();
  const BOUTONS: { titre: string; label: string; nom: string; attrs?: Record<string, unknown>; faire: () => void }[] = [
    { titre: "Titre", label: "T1", nom: "heading", attrs: { level: 1 }, faire: () => chaine().toggleHeading({ level: 1 }).run() },
    { titre: "Sous-titre", label: "T2", nom: "heading", attrs: { level: 2 }, faire: () => chaine().toggleHeading({ level: 2 }).run() },
    { titre: "Petit titre", label: "T3", nom: "heading", attrs: { level: 3 }, faire: () => chaine().toggleHeading({ level: 3 }).run() },
    { titre: "Gras", label: "G", nom: "bold", faire: () => chaine().toggleBold().run() },
    { titre: "Italique", label: "I", nom: "italic", faire: () => chaine().toggleItalic().run() },
    { titre: "Liste", label: "•", nom: "bulletList", faire: () => chaine().toggleBulletList().run() },
    { titre: "Liste numérotée", label: "1.", nom: "orderedList", faire: () => chaine().toggleOrderedList().run() },
    { titre: "Citation", label: "❝", nom: "blockquote", faire: () => chaine().toggleBlockquote().run() },
    { titre: "Code", label: "</>", nom: "codeBlock", faire: () => chaine().toggleCodeBlock().run() },
  ];
</script>

<div class="editeur">
  <div class="barre">
    {#if !brut}
      {#each BOUTONS as b (b.titre)}
        <button type="button" class:on={actif(b.nom, b.attrs)} title={b.titre} aria-label={b.titre} onmousedown={(e) => e.preventDefault()} onclick={b.faire}>{b.label}</button>
      {/each}
    {/if}
    <span class="espace"></span>
    {#if brutObligatoire}
      <span class="note">Texte brut : cette fiche contient un tableau, une image ou du HTML.</span>
    {:else}
      <button type="button" class="mode" onclick={basculer}>{brut ? "Mise en forme" : "Texte brut"}</button>
    {/if}
  </div>
  {#if brut}
    <textarea class="brut" bind:value={source} oninput={() => onchange(source, source !== texte)}></textarea>
  {:else}
    <div class="page" bind:this={zone}></div>
  {/if}
</div>

<style>
  .editeur {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }
  .barre {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 20px;
    border-bottom: 1px solid var(--border);
    flex: none;
  }
  .barre button {
    min-width: 32px;
    height: 30px;
    padding: 0 8px !important;
    border: 0 !important;
    background: none !important;
    border-radius: 8px;
    font-weight: 600;
    color: var(--muted);
  }
  .barre button:hover,
  .barre button.on {
    background: var(--field) !important;
    color: var(--text);
  }
  .barre .mode {
    font-weight: 500;
  }
  .espace {
    flex: 1;
  }
  .note {
    font-size: 12px;
    color: var(--muted);
  }
  .page {
    flex: 1;
    overflow-y: auto;
    padding: 24px 40px 40px;
  }
  .brut {
    flex: 1;
    margin: 16px 20px;
    resize: none;
    font-family: ui-monospace, Consolas, monospace;
    font-size: 13px !important;
  }
  .page :global(.tiptap) {
    outline: none;
    max-width: 760px;
    margin: 0 auto;
    font-size: 15px;
    line-height: 1.65;
    color: var(--text);
  }
  .page :global(.tiptap h1) {
    font-size: 26px;
    margin: 0 0 14px;
    line-height: 1.25;
  }
  .page :global(.tiptap h2) {
    font-size: 20px;
    margin: 26px 0 8px;
  }
  .page :global(.tiptap h3) {
    font-size: 16px;
    margin: 20px 0 6px;
  }
  .page :global(.tiptap p) {
    margin: 0 0 10px;
  }
  .page :global(.tiptap ul),
  .page :global(.tiptap ol) {
    padding-left: 22px;
    margin: 0 0 10px;
  }
  .page :global(.tiptap blockquote) {
    margin: 0 0 10px;
    padding: 2px 14px;
    border-left: 3px solid var(--border);
    color: var(--muted);
  }
  .page :global(.tiptap code) {
    background: var(--field);
    border-radius: 5px;
    padding: 1px 5px;
    font-size: 13px;
  }
  .page :global(.tiptap pre) {
    background: var(--field);
    border-radius: 10px;
    padding: 12px 14px;
    overflow-x: auto;
  }
  .page :global(.tiptap pre code) {
    background: none;
    padding: 0;
  }
  .page :global(.tiptap a) {
    color: var(--accent);
  }
  .page :global(.tiptap hr) {
    border: 0;
    border-top: 1px solid var(--border);
    margin: 18px 0;
  }
</style>
