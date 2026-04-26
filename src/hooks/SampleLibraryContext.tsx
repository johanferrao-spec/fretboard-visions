import { createContext, useContext, type ReactNode } from 'react';
import { useSampleLibrary } from './useSampleLibrary';

type LibValue = ReturnType<typeof useSampleLibrary>;

const Ctx = createContext<LibValue | null>(null);

/** Provides a single shared sample-library instance to the whole app, so
 *  the audio engine and the sampler UI both see the same list of samples
 *  and the same `active` map. Without this, two parallel `useSampleLibrary()`
 *  calls would each maintain their own React state and clobber each other's
 *  localStorage writes. */
export function SampleLibraryProvider({ children }: { children: ReactNode }) {
  const lib = useSampleLibrary();
  return <Ctx.Provider value={lib}>{children}</Ctx.Provider>;
}

export function useSharedSampleLibrary(): LibValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSharedSampleLibrary must be used inside <SampleLibraryProvider>');
  return v;
}
