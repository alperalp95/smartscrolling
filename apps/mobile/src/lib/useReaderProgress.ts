import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReaderTextSection } from './bookSections';
import { fetchReadingProgress, upsertReadingProgress } from './readingProgress';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type UseReaderProgressParams = {
  bookId: string;
  hasSectionContent: boolean;
  textSections: ReaderTextSection[];
  totalPages: number;
};

export function useReaderProgress(params: UseReaderProgressParams) {
  const { bookId, hasSectionContent, textSections, totalPages } = params;
  const [currentPage, setCurrentPage] = useState(1);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [progressHydrated, setProgressHydrated] = useState(false);
  const lastSyncedPageRef = useRef(0);
  const hasAppliedInitialSectionRef = useRef(false);
  const sectionOffsetsRef = useRef<Array<{ index: number; y: number }>>([]);

  const completionPercent = Math.round((currentPage / totalPages) * 100);
  const pagesLeft = Math.max(totalPages - currentPage, 0);

  const getSectionIndexForPage = useCallback(
    (page: number) => {
      if (!textSections.length) {
        return 0;
      }

      let consumedPages = 1;

      for (let index = 0; index < textSections.length; index += 1) {
        const section = textSections[index];
        const sectionLength = Math.max(
          section.estimated_pages ?? Math.max(1, Math.ceil(section.plainText.length / 900)),
          1,
        );
        const sectionEnd = consumedPages + sectionLength - 1;

        if (page <= sectionEnd) {
          return index;
        }

        consumedPages = sectionEnd + 1;
      }

      return textSections.length - 1;
    },
    [textSections],
  );

  const handleReaderScroll = (offsetY: number, contentHeight: number, viewportHeight: number) => {
    const maxOffset = Math.max(contentHeight - viewportHeight, 1);
    const progressRatio = clamp(offsetY / maxOffset, 0, 1);
    const derivedPage = clamp(Math.round(progressRatio * (totalPages - 1)) + 1, 1, totalPages);

    setCurrentPage((prevPage) => (prevPage === derivedPage ? prevPage : derivedPage));
  };

  const registerSectionOffset = (index: number, y: number) => {
    sectionOffsetsRef.current[index] = { index, y };
  };

  const syncActiveSectionFromScroll = (offsetY: number, viewportHeight: number) => {
    const probeY = offsetY + viewportHeight * 0.3;
    let nextIndex = 0;

    for (const sectionOffset of sectionOffsetsRef.current) {
      if (!sectionOffset) {
        continue;
      }

      if (probeY >= sectionOffset.y) {
        nextIndex = sectionOffset.index;
      } else {
        break;
      }
    }

    setActiveSectionIndex((current) => (current === nextIndex ? current : nextIndex));
  };

  useEffect(() => {
    if (!hasSectionContent || !progressHydrated || hasAppliedInitialSectionRef.current) {
      return;
    }

    const initialSectionIndex = getSectionIndexForPage(currentPage);
    hasAppliedInitialSectionRef.current = true;
    setActiveSectionIndex(initialSectionIndex);
  }, [currentPage, getSectionIndexForPage, hasSectionContent, progressHydrated]);

  useEffect(() => {
    let cancelled = false;

    const loadProgress = async () => {
      setProgressHydrated(false);
      setActiveSectionIndex(0);
      sectionOffsetsRef.current = [];
      hasAppliedInitialSectionRef.current = false;
      lastSyncedPageRef.current = 0;

      const progress = await fetchReadingProgress(bookId);

      if (cancelled) {
        return;
      }

      if (progress?.current_page) {
        const normalizedPage = clamp(progress.current_page, 1, totalPages);
        setCurrentPage(normalizedPage);
        lastSyncedPageRef.current = normalizedPage;
      } else {
        setCurrentPage(1);
      }

      setProgressHydrated(true);
    };

    void loadProgress();

    return () => {
      cancelled = true;
    };
  }, [bookId, totalPages]);

  useEffect(() => {
    if (!progressHydrated) {
      return;
    }

    if (currentPage === lastSyncedPageRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void (async () => {
        const result = await upsertReadingProgress({
          bookId,
          currentPage,
          completed: currentPage >= totalPages,
        });

        if (result.synced) {
          lastSyncedPageRef.current = currentPage;
        }
      })();
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [bookId, currentPage, progressHydrated, totalPages]);

  return {
    activeSectionIndex,
    completionPercent,
    currentPage,
    handleReaderScroll,
    pagesLeft,
    progressHydrated,
    registerSectionOffset,
    setActiveSectionIndex,
    syncActiveSectionFromScroll,
  };
}
