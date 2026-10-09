const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');
menuToggle?.addEventListener('click', () => {
  const open = mainNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
});
mainNav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => mainNav.classList.remove('open')));

const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const productCards = [...document.querySelectorAll('.product-card')];
const noResults = document.getElementById('noResults');
function filterProducts(term) {
  const q = term.trim().toLocaleLowerCase('fr');
  let visible = 0;
  productCards.forEach(card => {
    const match = !q || card.dataset.name.toLocaleLowerCase('fr').includes(q) || card.textContent.toLocaleLowerCase('fr').includes(q);
    card.hidden = !match;
    if (match) visible++;
  });
  noResults.hidden = visible > 0;
  document.getElementById('produits').scrollIntoView({behavior:'smooth'});
}
searchForm?.addEventListener('submit', e => {
  e.preventDefault();
  filterProducts(searchInput.value);
});
document.querySelectorAll('.category-card').forEach(card => {
  card.addEventListener('click', () => {
    const terms = card.dataset.search.split(' ');
    searchInput.value = terms[0];
    filterProducts(terms[0]);
  });
});
document.getElementById('contactForm')?.addEventListener('submit', e => {
  e.preventDefault();
  document.getElementById('formMessage').textContent = 'Merci ! Le formulaire est une démonstration : aucun message n’a été envoyé.';
});

// Logistics demo CTA scrolls to the contact form; no real booking is sent.
document.querySelectorAll('.logistics-contact').forEach(link => {
  link.addEventListener('click', () => {
    const profile = document.querySelector('#contactForm select');
    if (profile) profile.value = 'Acheteur';
  });
});

// MetaLink Logistique connected to Supabase (public publishable key only).
(() => {
  const SUPABASE_URL = 'https://wfdkelpwmgcnmuqzuptl.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ajabL-jTRAkdzZ80r2zywQ_X-ECu5yO';
  const tabs = document.querySelectorAll('.logistics-tab');
  const carrierForm = document.getElementById('carrierForm');
  const shipperForm = document.getElementById('shipperForm');
  const listings = document.getElementById('logisticsListings');
  const status = document.getElementById('logisticsStatus');
  if (!carrierForm || !shipperForm || !listings) return;

  if (!window.supabase) {
    status.hidden = false;
    status.textContent = 'Connexion impossible : la bibliothèque de base de données ne s’est pas chargée. Vérifiez votre connexion Internet.';
    return;
  }
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  const authForm = document.getElementById('authForm');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const authStatus = document.getElementById('authStatus');
  const authSubmit = document.getElementById('authSubmit');
  const signInMode = document.getElementById('signInMode');
  const signUpMode = document.getElementById('signUpMode');
  const resetPassword = document.getElementById('resetPassword');
  const signOutButton = document.getElementById('signOutButton');
  let authMode = 'signin';
  let currentUser = null;
  function showAuthMessage(message, isError = false) {
    if (!authStatus) return;
    authStatus.textContent = message;
    authStatus.classList.toggle('error', isError);
  }
  function setAuthMode(mode) {
    authMode = mode;
    signInMode?.classList.toggle('active', mode === 'signin');
    signUpMode?.classList.toggle('active', mode === 'signup');
    if (authSubmit) authSubmit.textContent = mode === 'signup' ? 'Créer mon compte →' : 'Se connecter →';
    if (authPassword) authPassword.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    showAuthMessage(mode === 'signup' ? 'Créez un compte avec votre adresse e-mail.' : 'Saisissez votre adresse e-mail et votre mot de passe.');
  }
  signInMode?.addEventListener('click', () => setAuthMode('signin'));
  signUpMode?.addEventListener('click', () => setAuthMode('signup'));
  function updateAuthUI(user) {
    currentUser = user || null;
    if (currentUser) {
      showAuthMessage('Connecté : ' + (currentUser.email || 'compte MetaLink') + '. Vous pouvez publier vos annonces.');
      if (signOutButton) signOutButton.hidden = false;
      if (authSubmit) authSubmit.hidden = true;
      if (authEmail) authEmail.value = currentUser.email || '';
      if (authPassword) authPassword.value = '';
    } else {
      showAuthMessage('Vous n’êtes pas connecté. Connectez-vous pour publier une annonce.');
      if (signOutButton) signOutButton.hidden = true;
      if (authSubmit) authSubmit.hidden = false;
    }
  }
  authForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!authEmail?.value || !authPassword?.value) return;
    authSubmit.disabled = true;
    authSubmit.textContent = authMode === 'signup' ? 'Création en cours…' : 'Connexion…';
    try {
      const email = authEmail.value.trim();
      const password = authPassword.value;
      if (authMode === 'signup') {
        const { data, error } = await db.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
        if (error) throw error;
        if (data.session) updateAuthUI(data.user);
        else showAuthMessage('Compte créé. Consultez votre boîte e-mail et confirmez votre adresse avant de vous connecter.');
      } else {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        updateAuthUI(data.user);
      }
    } catch (error) {
      showAuthMessage(error.message || 'Échec de l’authentification. Vérifiez les informations et les réglages Supabase.', true);
    } finally {
      authSubmit.disabled = false;
      if (!currentUser) authSubmit.textContent = authMode === 'signup' ? 'Créer mon compte →' : 'Se connecter →';
    }
  });
  resetPassword?.addEventListener('click', async () => {
    const email = authEmail?.value.trim();
    if (!email) {
      showAuthMessage('Saisissez d’abord votre adresse e-mail pour recevoir le lien de réinitialisation.', true);
      authEmail?.focus();
      return;
    }
    resetPassword.disabled = true;
    try {
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
      if (error) throw error;
      showAuthMessage('Si cette adresse est enregistrée, un e-mail de réinitialisation va être envoyé.');
    } catch (error) {
      showAuthMessage(error.message || 'Impossible d’envoyer le lien de réinitialisation.', true);
    } finally {
      resetPassword.disabled = false;
    }
  });
  signOutButton?.addEventListener('click', async () => {
    signOutButton.disabled = true;
    const { error } = await db.auth.signOut();
    signOutButton.disabled = false;
    if (error) showAuthMessage(error.message, true);
    else updateAuthUI(null);
  });
  db.auth.getSession().then(({ data, error }) => {
    if (error) showAuthMessage(error.message, true);
    updateAuthUI(data?.session?.user || null);
  });
  db.auth.onAuthStateChange((_event, session) => updateAuthUI(session?.user || null));


  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(item => {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });
    document.getElementById('carrierPanel')?.classList.toggle('active', tab.dataset.panel === 'carrierPanel');
    document.getElementById('shipperPanel')?.classList.toggle('active', tab.dataset.panel === 'shipperPanel');
    (tab.dataset.panel === 'carrierPanel' ? carrierForm : shipperForm).scrollIntoView({behavior:'smooth', block:'center'});
  }));

  function escapeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function displayDate(value) {
    if (!value) return 'Date à convenir';
    const parts = value.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  }
  function renderListing(row) {
    const isCarrier = row.type_annonce === 'offre_transport';
    const title = isCarrier ? 'Camion disponible' : 'Demande de transport';
    const subtitle = isCarrier
      ? `${row.type_camion || 'Camion à préciser'} · ${row.quantite_tonnes ?? '—'} t`
      : `${row.marchandise || 'Marchandise à préciser'} · ${row.quantite_tonnes ?? '—'} t`;
    const info = row.informations || 'Aucune information complémentaire';
    const dateMatch = info.match(/Date : ([^|]+)/);
    const priceMatch = info.match(/(?:Prix souhaité|Budget indicatif) : ([^|]+)/);
    const details = info.split('|').map(part => part.trim()).filter(part => !/^Date :|^Prix souhaité :|^Budget indicatif :/.test(part)).join(' · ');
    const card = document.createElement('article');
    card.className = 'listing-card';
    card.innerHTML = `<div class="listing-type ${isCarrier ? 'carrier' : 'shipper'}">${isCarrier ? '🚚 OFFRE TRANSPORTEUR' : '📦 DEMANDE CLIENT'}</div>
      <div class="listing-main"><h4>${escapeText(title)} : ${escapeText(row.ville_depart)} → ${escapeText(row.ville_arrivee)}</h4>
      <p>${escapeText(subtitle)}</p><p>${isCarrier ? 'Marchandises acceptées' : 'Détails'} : ${escapeText(details || 'À préciser')}</p></div>
      <div class="listing-meta"><span>📅 ${escapeText(displayDate(dateMatch ? dateMatch[1].trim() : ''))}</span><span>💰 ${escapeText(priceMatch ? priceMatch[1].trim() : 'À négocier')}</span><span>☎ ${escapeText(row.telephone || 'Non indiqué')}</span></div>`;
    return card;
  }
  async function loadListings() {
    listings.innerHTML = '<p class="empty-list">Chargement des annonces…</p>';
    const { data, error } = await db.from('annonces').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) {
      listings.innerHTML = '<p class="empty-list">Impossible de charger les annonces. Vérifiez les paramètres Supabase et les politiques RLS.</p>';
      status.hidden = false;
      status.textContent = `Erreur de lecture : ${error.message}`;
      return;
    }
    listings.innerHTML = '';
    if (!data || data.length === 0) {
      listings.innerHTML = '<p class="empty-list">Aucune annonce pour le moment. Publiez la première offre ou demande.</p>';
      return;
    }
    data.forEach(row => listings.appendChild(renderListing(row)));
  }
  async function submitToDatabase(form, type) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form).entries());
      const isCarrier = type === 'carrier';
      const infoParts = [`Date : ${data.date || 'À convenir'}`];
      const price = isCarrier ? data.price : data.budget;
      infoParts.push(`${isCarrier ? 'Prix souhaité' : 'Budget indicatif'} : ${price ? `${Number(price).toLocaleString('fr-FR')} DA` : 'À négocier'}`);
      const details = isCarrier ? data.cargo : data.details;
      if (details && details.trim()) infoParts.push(details.trim());
      const button = form.querySelector('button[type="submit"]');
      if (!currentUser) {
        if (button) {
          button.disabled = false;
          button.textContent = isCarrier ? 'Publier l’offre de transport →' : 'Publier ma demande →';
        }
        status.hidden = false;
        status.textContent = 'Connectez-vous ou créez un compte dans la section Connexion avant de publier.';
        document.getElementById('auth')?.scrollIntoView({behavior:'smooth'});
        return;
      }
      const row = {
        user_id: currentUser.id,
        type_annonce: isCarrier ? 'offre_transport' : 'demande_transport',
        ville_depart: data.origin.trim(),
        ville_arrivee: data.destination.trim(),
        marchandise: isCarrier ? (data.cargo || 'À préciser') : data.cargoType,
        quantite_tonnes: Number(isCarrier ? data.capacity : data.weight),
        type_camion: isCarrier ? data.vehicle : null,
        telephone: data.phone.trim(),
        informations: infoParts.join(' | ')
      };
      if (button) { button.disabled = true; button.textContent = 'Publication en cours…'; }
      status.hidden = false;
      status.textContent = 'Envoi de votre annonce…';
      const { error } = await db.from('annonces').insert(row);
      if (button) { button.disabled = false; button.textContent = isCarrier ? 'Publier l’offre de transport →' : 'Publier ma demande →'; }
      if (error) {
        status.textContent = `Échec de la publication : ${error.message}. Vérifiez la connexion et les règles de la base de données.`;
        return;
      }
      status.textContent = 'Annonce publiée avec succès ! Elle est maintenant enregistrée dans la base de données.';
      form.reset();
      await loadListings();
      listings.scrollIntoView({behavior:'smooth', block:'nearest'});
    });
  }
  submitToDatabase(carrierForm, 'carrier');
  submitToDatabase(shipperForm, 'shipper');
  loadListings();
})();

/* Chat remains clearly marked as a demo until a real conversation is selected.
   Advertising requests are saved to ad_requests for the authenticated user. */
(() => {
  const chatForm = document.getElementById('chatDemoForm');
  const chatInput = document.getElementById('chatDemoInput');
  const chatMessages = document.getElementById('driverChatMessages');
  const chatStatus = document.getElementById('chatDemoStatus');
  chatForm?.addEventListener('submit', event => {
    event.preventDefault();
    if (chatStatus) chatStatus.textContent = 'الدردشة الحقيقية لم تُفعّل في هذه الواجهة بعد. لم يتم إرسال الرسالة أو حفظها.';
  });

  const adForm = document.getElementById('adRequestForm');
  const adStatus = document.getElementById('adRequestStatus');
  if (!adForm) return;

  adForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!adForm.reportValidity()) return;
    const submitButton = adForm.querySelector('button[type="submit"]');
    const data = new FormData(adForm);
    const companyName = String(data.get('company') || '').trim();
    const adType = String(data.get('adType') || '').trim();
    const requestedStyle = String(data.get('style') || '').trim();
    const brief = String(data.get('brief') || '').trim();
    const contactDetails = String(data.get('contact') || '').trim();

    if (!window.supabase) {
      adStatus.textContent = 'تعذر الاتصال بخدمة قاعدة البيانات. حدّث الصفحة وحاول مجددًا.';
      adStatus.classList.add('error');
      return;
    }

    const SUPABASE_URL = 'https://wfdkelpwmgcnmuqzuptl.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ajabL-jTRAkdzZ80r2zywQ_X-ECu5yO';
    const adDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Envoi en cours…';
    }
    adStatus.classList.remove('error', 'prepared');

    try {
      const { data: authData, error: authError } = await adDb.auth.getUser();
      if (authError) throw authError;
      const user = authData?.user;
      if (!user) {
        adStatus.textContent = 'يرجى تسجيل الدخول أولًا قبل إرسال طلب الإشهار. لم يتم حفظ أي بيانات.';
        document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      const { error } = await adDb.from('ad_requests').insert({
        user_id: user.id,
        company_name: companyName,
        ad_type: adType,
        requested_style: requestedStyle,
        brief,
        contact_details: contactDetails,
        status: 'pending'
      });
      if (error) throw error;

      adStatus.textContent = 'تم إرسال طلب الإشهار وحفظه بنجاح. حالته الآن: قيد المراجعة.';
      adStatus.classList.add('prepared');
      adForm.reset();
    } catch (error) {
      adStatus.textContent = 'تعذر حفظ طلب الإشهار: ' + (error?.message || 'خطأ غير معروف') + '. تحقق من تسجيل الدخول وسياسات RLS ثم أعد المحاولة.';
      adStatus.classList.add('error');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'إرسال طلب الإشهار ↗';
      }
    }
  });
})();