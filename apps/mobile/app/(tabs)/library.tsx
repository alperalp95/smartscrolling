import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumUpsellCard } from '../../components/premium-upsell-card';
import { promptForAuth } from '../../src/lib/authPrompt';
import {
  FALLBACK_BOOKS,
  fetchContinueBooks,
  fetchLibraryBooks,
  resolveBookAccess,
} from '../../src/lib/books';
import { fetchSavedFacts } from '../../src/lib/facts';
import { promptForPremium } from '../../src/lib/premiumPrompt';
import { useAuthStore } from '../../src/store/authStore';
import { useFeedStore } from '../../src/store/feedStore';
import type { BookType, FactType } from '../../src/types';

const MEDITATIONS_BOOK_ID = '11111111-1111-1111-1111-111111111111';

function BookCover({
  book,
  size,
}: {
  book: BookType;
  size: 'lg' | 'sm';
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const isMeditations = book.id === MEDITATIONS_BOOK_ID;
  const category = (book.category ?? '').toLowerCase();
  const shouldUseBrandedCover = isMeditations || !book.coverUrl || hasImageError;

  const coverStyle = size === 'lg' ? s.bookCoverLg : s.bookCoverSm;
  const imageStyle = size === 'lg' ? s.bookImageLg : s.bookImageSm;
  const titleStyle = size === 'lg' ? s.bookFallbackTitleLarge : s.bookFallbackTitle;
  const accentStyle = size === 'lg' ? s.coverAccentLg : s.coverAccentSm;

  if (!shouldUseBrandedCover) {
    return (
      <View style={coverStyle}>
        <Image
          onError={() => setHasImageError(true)}
          resizeMode="cover"
          source={{ uri: book.coverUrl ?? '' }}
          style={imageStyle}
        />
      </View>
    );
  }

  const themeStyles = isMeditations
    ? {
        accent: s.meditationsAccent,
        bg: s.meditationsCover,
        eyebrow: 'Stoic Notes',
      }
    : category.includes('bilim')
      ? {
          accent: s.scienceAccent,
          bg: s.scienceCover,
          eyebrow: 'Science Shelf',
        }
      : category.includes('tarih')
        ? {
            accent: s.historyAccent,
            bg: s.historyCover,
            eyebrow: 'History Shelf',
          }
        : category.includes('siyaset')
          ? {
              accent: s.politicsAccent,
              bg: s.politicsCover,
              eyebrow: 'Political Thought',
            }
          : category.includes('toplum')
            ? {
                accent: s.societyAccent,
                bg: s.societyCover,
                eyebrow: 'Social Thought',
              }
            : category.includes('felsefe')
              ? {
                  accent: s.philosophyAccent,
                  bg: s.philosophyCover,
                  eyebrow: 'Philosophy Shelf',
                }
              : {
                  accent: s.genericAccent,
                  bg: s.genericCover,
                  eyebrow: 'Learning Text',
                };

  return (
    <View style={[coverStyle, themeStyles.bg]}>
      <View style={[accentStyle, themeStyles.accent]} />
      <Text style={s.coverEyebrow}>{themeStyles.eyebrow}</Text>
      <Text numberOfLines={size === 'lg' ? 3 : 2} style={titleStyle}>
        {book.title}
      </Text>
      <Text numberOfLines={1} style={s.coverAuthor}>
        {book.author}
      </Text>
    </View>
  );
}

export default function LibraryScreen() {
  const isFocused = useIsFocused();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const topPadding = Math.max(insets.top, Platform.OS === 'web' ? 24 : 0);
  const user = useAuthStore((state) => state.user);
  const hasPremium = useAuthStore((state) => state.hasPremium);
  const setPostAuthRedirectPath = useAuthStore((state) => state.setPostAuthRedirectPath);
  const savedIds = useFeedStore((state) => state.savedIds);
  const savedIdsVersion = savedIds.join('|');
  const [books, setBooks] = useState<BookType[]>(FALLBACK_BOOKS);
  const [continueBooks, setContinueBooks] = useState<Array<BookType & { progress: number }>>([]);
  const [savedFacts, setSavedFacts] = useState<FactType[]>([]);
  const openBookLockedRef = useRef(false);
  const openBookLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleSavedFacts = useMemo(
    () => savedFacts.filter((fact) => savedIds.includes(fact.id)),
    [savedFacts, savedIds],
  );

  const clearOpenBookLock = useCallback(() => {
    openBookLockedRef.current = false;
    if (openBookLockTimeoutRef.current) {
      clearTimeout(openBookLockTimeoutRef.current);
      openBookLockTimeoutRef.current = null;
    }
  }, []);

  const armOpenBookLock = useCallback((durationMs = 900) => {
    openBookLockedRef.current = true;
    if (openBookLockTimeoutRef.current) {
      clearTimeout(openBookLockTimeoutRef.current);
    }
    openBookLockTimeoutRef.current = setTimeout(() => {
      openBookLockedRef.current = false;
      openBookLockTimeoutRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [nextBooks, nextContinueBooks] = await Promise.all([
        fetchLibraryBooks(),
        fetchContinueBooks(user?.id, false),
      ]);

      if (cancelled) {
        return;
      }

      setBooks(nextBooks);
      setContinueBooks(nextContinueBooks);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!isFocused && !savedIdsVersion) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const nextSavedFacts = await fetchSavedFacts(user?.id, 8);

      if (cancelled) {
        return;
      }

      setSavedFacts(nextSavedFacts);
    })();

    return () => {
      cancelled = true;
    };
  }, [isFocused, savedIdsVersion, user?.id]);

  useEffect(() => {
    if (isFocused) {
      clearOpenBookLock();
    }
  }, [clearOpenBookLock, isFocused]);

  useEffect(() => () => clearOpenBookLock(), [clearOpenBookLock]);

  const openBook = (book: BookType) => {
    if (openBookLockedRef.current) {
      return;
    }

    armOpenBookLock();

    const access = resolveBookAccess(book, {
      hasPremium,
      isAuthenticated: Boolean(user),
    });

    if (access.needsAuth) {
      promptForAuth({
        onConfirm: () => {
          clearOpenBookLock();
          setPostAuthRedirectPath(`/book/${book.id}`);
          router.push('/profile');
        },
        message: 'Bu premium kitabi acmadan once giris yapman gerekir.',
      });
      return;
    }

    if (access.needsPremium) {
      promptForPremium({
        title: `${book.title} premium kutuphanede`,
        message:
          'Bu metin premium kutuphane katmaninda yer aliyor. Premium ile tum kutuphaneyi, reklamsiz deneyimi ve daha derin AI akislarini acabileceksin.',
        onConfirm: () => {
          clearOpenBookLock();
          router.push('/premium');
        },
      });
      return;
    }

    router.push(`/book/${book.id}`);
  };

  return (
    <View style={[s.container, Platform.OS === 'web' && !isFocused ? s.webHiddenScreen : null]}>
      <View style={[s.header, { paddingTop: topPadding + 10 }]}>
        <Text style={s.title}>Kutuphane</Text>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: tabBarHeight + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.searchBar}>
          <Ionicons name="search" size={16} color="#48484a" />
          <TextInput
            placeholder="Kitap veya yazar ara..."
            placeholderTextColor="#48484a"
            style={s.searchInput}
          />
        </View>

        {!user && (
          <View style={s.guestBanner}>
            <View style={{ flex: 1 }}>
              <Text style={s.guestBannerTitle}>Misafir modunda free katalogu geziyorsun</Text>
              <Text style={s.guestBannerText}>
                Serbest anchor metni hemen okuyabilirsin. Diger ogrenme metinleri icin giris, derin
                katalog icin ise premium gerekecek.
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/profile')} style={s.guestBannerButton}>
              <Text style={s.guestBannerButtonText}>Giris Yap</Text>
            </TouchableOpacity>
          </View>
        )}

        {user && !hasPremium ? (
          <PremiumUpsellCard
            title="Kutuphanenin tamamina premium ile gec"
            body="Reklamsiz okumaya devam et, tum ogrenme kutuphanesini ac ve serbest AI sorularini kullan."
            onPress={() =>
              promptForPremium({
                title: 'Premium ile tum kutuphaneyi ac',
                message:
                  'Bu akista premium, tum kitaplara erisim, reklamsiz kullanim ve daha guclu AI deneyimi saglar.',
                onConfirm: () => router.push('/premium'),
              })
            }
          />
        ) : null}

        {user && hasPremium ? (
          <View style={s.premiumActiveBanner}>
            <View style={s.premiumActiveIcon}>
              <Ionicons name="star" size={16} color="#f5b942" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.premiumActiveTitle}>Premium kutuphane acik</Text>
              <Text style={s.premiumActiveText}>
                Tum kitaplara, serbest AI sorularina ve reklamsiz deneyime erisimin var.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Kaydettiklerim</Text>
          <TouchableOpacity
            disabled={!user || savedFacts.length === 0}
            onPress={() => router.push('/saved-facts' as never)}
          >
            <Text style={s.sectionMore}>
              {user
                ? visibleSavedFacts.length > 0
                  ? 'Tumu'
                  : `${visibleSavedFacts.length} kayit`
                : 'Giris ile acilir'}
            </Text>
          </TouchableOpacity>
        </View>

        {!user ? (
          <View style={s.savedGuestCard}>
            <View style={s.savedGuestIconWrap}>
              <Ionicons name="bookmark" size={18} color="#f5b942" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.savedGuestTitle}>Kaydettigin fact'ler burada birikecek</Text>
              <Text style={s.savedGuestText}>
                Giris yaptiginda feed'de kaydettigin bilgi kartlarini tek yerde gorup daha sonra
                tekrar okuyabileceksin.
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/profile')} style={s.savedGuestButton}>
              <Text style={s.savedGuestButtonText}>Giris Yap</Text>
            </TouchableOpacity>
          </View>
        ) : visibleSavedFacts.length > 0 ? (
          <ScrollView
            contentContainerStyle={s.hRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {visibleSavedFacts.map((fact) => (
              <TouchableOpacity
                key={fact.id}
                activeOpacity={0.85}
                onPress={() => router.push(`/fact/${fact.id}` as never)}
                style={s.savedFactCard}
              >
                <View style={s.savedFactHeader}>
                  <View style={s.savedFactBadge}>
                    <Text style={s.savedFactBadgeText}>{fact.category}</Text>
                  </View>
                  {fact.verified ? (
                    <View style={s.savedFactVerified}>
                      <Ionicons name="checkmark-circle" size={12} color="#a78bfa" />
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={2} style={s.savedFactTitle}>
                  {fact.title}
                </Text>
                <Text numberOfLines={4} style={s.savedFactContent}>
                  {fact.content}
                </Text>
                <View style={s.savedFactFooter}>
                  <Text numberOfLines={1} style={s.savedFactSource}>
                    {fact.source_label ?? 'Kaynak belirtilmedi'}
                  </Text>
                  <Text style={s.savedFactOpenText}>Ac</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={s.savedEmptyCard}>
            <Text style={s.savedEmptyTitle}>Henuz kaydettigin bir fact yok</Text>
            <Text style={s.savedEmptyText}>
              Akis ekraninda ilgini ceken kartlari kaydettiginde burada yeniden bulacaksin.
            </Text>
          </View>
        )}

        {user && continueBooks.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Devam Et</Text>
              <TouchableOpacity>
                <Text style={s.sectionMore}>Tumu</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={s.hRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {continueBooks.map((book) => (
                <TouchableOpacity
                  key={book.id}
                  onPress={() => openBook(book)}
                  style={s.continueCard}
                  activeOpacity={0.8}
                >
                  <BookCover book={book} size="sm" />
                  <View style={s.progressBarBg}>
                    <View style={[s.progressBarFill, { width: `${book.progress}%` }]} />
                  </View>
                  <Text style={s.bookTitleSm} numberOfLines={1}>
                    {book.title}
                  </Text>
                  <Text style={s.bookAuthorSm}>
                    {book.author} · %{book.progress}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <View style={[s.sectionHeader, { marginTop: 24 }]}>
          <Text style={s.sectionTitle}>10 Kitaplik Ogrenme Kutuphanesi</Text>
          <TouchableOpacity>
            <Text style={s.sectionMore}>{books.length} kitap</Text>
          </TouchableOpacity>
        </View>
        <View style={s.grid}>
          {books.map((book) => {
            const access = resolveBookAccess(book, {
              hasPremium,
              isAuthenticated: Boolean(user),
            });

            return (
              <TouchableOpacity
                key={book.id}
                onPress={() => openBook(book)}
                style={s.gridItem}
                activeOpacity={0.8}
              >
                <View>
                  <BookCover book={book} size="lg" />
                  <View style={[s.premiumBadge, access.isFreeAnchor ? s.freeBadge : s.lockedBadge]}>
                    <Ionicons
                      color={access.isFreeAnchor ? '#0a0a0a' : '#fff'}
                      name={access.isFreeAnchor ? 'sparkles' : 'lock-closed'}
                      size={10}
                    />
                    <Text style={[s.premiumText, access.isFreeAnchor ? s.freeBadgeText : null]}>
                      {access.badgeLabel}
                    </Text>
                  </View>
                </View>
                <Text numberOfLines={2} style={s.bookTitleGrid}>
                  {book.title}
                </Text>
                <Text style={s.bookAuthorGrid}>{book.author}</Text>
                <Text numberOfLines={2} style={s.accessHint}>
                  {access.helperText}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: '#000',
  },
  title: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  scroll: { paddingTop: 8 },
  searchBar: {
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  searchInput: { color: '#fff', flex: 1, fontSize: 15 },
  guestBanner: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderColor: 'rgba(167,139,250,0.25)',
    borderRadius: 16,
    borderWidth: 0.5,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
    marginHorizontal: 16,
    padding: 14,
  },
  guestBannerTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  guestBannerText: { color: '#c4b5fd', fontSize: 12, lineHeight: 18 },
  guestBannerButton: {
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  guestBannerButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  premiumActiveBanner: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245,185,66,0.08)',
    borderColor: 'rgba(245,185,66,0.24)',
    borderRadius: 16,
    borderWidth: 0.5,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
    marginHorizontal: 16,
    padding: 14,
  },
  premiumActiveIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(245,185,66,0.12)',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  premiumActiveTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  premiumActiveText: { color: '#f8e6b3', fontSize: 12, lineHeight: 18 },
  savedGuestCard: {
    alignItems: 'flex-start',
    backgroundColor: '#141416',
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    borderWidth: 0.5,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
    marginHorizontal: 16,
    padding: 14,
  },
  savedGuestIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(245,185,66,0.12)',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  savedGuestTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  savedGuestText: { color: '#b3b3b8', fontSize: 12, lineHeight: 18 },
  savedGuestButton: {
    alignItems: 'center',
    backgroundColor: '#27272a',
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  savedGuestButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sectionMore: { color: '#a78bfa', fontSize: 14, fontWeight: '600' },
  hRow: { gap: 12, paddingHorizontal: 16, paddingBottom: 4 },
  savedFactCard: {
    backgroundColor: '#111214',
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 0.5,
    minHeight: 174,
    padding: 14,
    width: 232,
  },
  savedFactHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  savedFactBadge: {
    backgroundColor: 'rgba(167,139,250,0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  savedFactBadgeText: { color: '#c4b5fd', fontSize: 11, fontWeight: '700' },
  savedFactVerified: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedFactTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 8,
  },
  savedFactContent: {
    color: '#c8c8ce',
    fontSize: 12,
    lineHeight: 18,
  },
  savedFactSource: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    paddingRight: 10,
  },
  savedFactFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 'auto',
    paddingTop: 12,
  },
  savedFactOpenText: {
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: '700',
  },
  savedEmptyCard: {
    backgroundColor: '#111214',
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 0.5,
    marginBottom: 22,
    marginHorizontal: 16,
    padding: 16,
  },
  savedEmptyTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  savedEmptyText: { color: '#8e8e93', fontSize: 12, lineHeight: 18 },
  continueCard: { width: 140 },
  bookCoverSm: {
    borderRadius: 14,
    height: 196,
    overflow: 'hidden',
    padding: 14,
    width: 140,
  },
  bookImageSm: { width: '100%', height: '100%' },
  bookFallbackTitle: { color: '#f8fafc', fontSize: 24, fontWeight: '800', marginTop: 'auto' },
  progressBarBg: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    height: 3,
    marginTop: 8,
  },
  progressBarFill: { backgroundColor: '#a78bfa', borderRadius: 2, height: '100%' },
  bookTitleSm: { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 6 },
  bookAuthorSm: { color: '#8e8e93', fontSize: 11, marginTop: 2 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: 16,
  },
  gridItem: { width: '47%' },
  bookCoverLg: {
    aspectRatio: 2 / 3,
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
    padding: 16,
    width: '100%',
  },
  bookImageLg: { width: '100%', height: '100%' },
  bookFallbackTitleLarge: { color: '#f8fafc', fontSize: 28, fontWeight: '800', marginTop: 'auto' },
  genericCover: {
    backgroundColor: '#111827',
    borderColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    justifyContent: 'flex-start',
  },
  meditationsCover: {
    backgroundColor: '#17261f',
    borderColor: 'rgba(212,175,55,0.18)',
    borderWidth: 1,
    justifyContent: 'flex-start',
  },
  prideCover: {
    backgroundColor: '#2c1b24',
    borderColor: 'rgba(255,214,220,0.14)',
    borderWidth: 1,
    justifyContent: 'flex-start',
  },
  philosophyCover: {
    backgroundColor: '#221b33',
    borderColor: 'rgba(196,181,253,0.14)',
    borderWidth: 1,
    justifyContent: 'flex-start',
  },
  historyCover: {
    backgroundColor: '#2c2117',
    borderColor: 'rgba(245,158,11,0.16)',
    borderWidth: 1,
    justifyContent: 'flex-start',
  },
  scienceCover: {
    backgroundColor: '#14253a',
    borderColor: 'rgba(96,165,250,0.18)',
    borderWidth: 1,
    justifyContent: 'flex-start',
  },
  politicsCover: {
    backgroundColor: '#2a1719',
    borderColor: 'rgba(248,113,113,0.18)',
    borderWidth: 1,
    justifyContent: 'flex-start',
  },
  societyCover: {
    backgroundColor: '#162723',
    borderColor: 'rgba(52,211,153,0.18)',
    borderWidth: 1,
    justifyContent: 'flex-start',
  },
  coverAccentLg: {
    borderRadius: 999,
    height: 6,
    marginBottom: 14,
    width: 56,
  },
  coverAccentSm: {
    borderRadius: 999,
    height: 5,
    marginBottom: 12,
    width: 44,
  },
  genericAccent: { backgroundColor: '#8b5cf6' },
  meditationsAccent: { backgroundColor: '#d4af37' },
  prideAccent: { backgroundColor: '#f9a8d4' },
  philosophyAccent: { backgroundColor: '#c4b5fd' },
  historyAccent: { backgroundColor: '#f59e0b' },
  scienceAccent: { backgroundColor: '#60a5fa' },
  politicsAccent: { backgroundColor: '#f87171' },
  societyAccent: { backgroundColor: '#34d399' },
  coverEyebrow: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  coverAuthor: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  premiumBadge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    position: 'absolute',
    right: 8,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  freeBadge: {
    backgroundColor: 'rgba(255,214,10,0.92)',
  },
  lockedBadge: {
    backgroundColor: 'rgba(17,24,39,0.92)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    borderWidth: 0.5,
  },
  premiumText: { color: '#000', fontSize: 10, fontWeight: '700' },
  freeBadgeText: { color: '#0a0a0a' },
  bookTitleGrid: { color: '#fff', fontSize: 14, fontWeight: '600' },
  bookAuthorGrid: { color: '#8e8e93', fontSize: 12, marginTop: 2 },
  accessHint: { color: '#8e8e93', fontSize: 11, lineHeight: 16, marginTop: 6 },
  webHiddenScreen: {
    display: 'none',
  },
});
