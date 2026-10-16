export default function GalleryNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ivory px-6 text-center">
      <p className="signature">J O A N A • M I R E L L Y • F O T O G R A F I A</p>
      <span className="my-10 block h-px w-14 bg-ink/20" aria-hidden />
      <h1 className="font-serif text-4xl font-light text-ink">Galeria não encontrada</h1>
      <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-soft">
        O link pode estar incorreto ou a galeria ainda não foi publicada. Confira o endereço
        recebido ou entre em contato com a fotógrafa.
      </p>
    </main>
  );
}

