(() => {
  'use strict';

  const SUPABASE_URL = 'https://wfdkelpwmgcnmuqzuptl.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ajabL-jTRAkdzZ80r2zywQ_X-ECu5yO';
  const $ = (id) => document.getElementById(id);
  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const dateText = (value) => {
    if (!value) return 'التاريخ غير محدد';
    const parts = String(value).split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : String(value);
  };
  const showStatus = (element, message, kind = '') => {
    if (!element) return;
    element.textContent = message;
    element.classList.remove('error', 'success');
    if (kind) element.classList.add(kind);
    element.hidden = !message;
  };

  if (!window.supabase) {
    showStatus($('logisticsStatus'), 'تعذر تحميل خدمة الاتصال. تحقق من الإنترنت ثم حدّث الصفحة.', 'error');
    return;
  }
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  let currentUser = null;
  let authMode = 'signin';
  let announcements = [];
  let conversations = [];
  let activeConversation = null;
  let refreshTimer = null;

  // Main navigation actions: the four big buttons scroll directly to their task.
  document.querySelectorAll('.quick-card').forEach((link) => {
    link.addEventListener('click', () => {
      if (link.getAttribute('href') === '#publish') {
        const isCarrier = link.classList.contains('blue-card');
        document.querySelectorAll('.switch').forEach((button) => {
          const active = button.dataset.panel === (isCarrier ? 'carrierPanel' : 'shipperPanel');
          button.classList.toggle('active', active);
          button.setAttribute('aria-selected', String(active));
        });
        $('carrierPanel').classList.toggle('active', isCarrier);
        $('shipperPanel').classList.toggle('active', !isCarrier);
      }
    });
  });

  document.querySelectorAll('.switch').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.switch').forEach((other) => {
        const active = other === button;
        other.classList.toggle('active', active);
        other.setAttribute('aria-selected', String(active));
      });
      $('carrierPanel').classList.toggle('active', button.dataset.panel === 'carrierPanel');
      $('shipperPanel').classList.toggle('active', button.dataset.panel === 'shipperPanel');
    });
  });

  // Voice input is optional and only uses the browser's speech recognition when available.
  document.querySelectorAll('[data-voice-for]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = $(button.dataset.voiceFor);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        const status = button.closest('form')?.querySelector('.status-message') || $('logisticsStatus');
        showStatus(status, 'الإملاء الصوتي غير مدعوم في هذا المتصفح. يمكنك الكتابة أو استخدام لوحة المفاتيح الصوتية في الهاتف.', 'error');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-DZ';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      button.classList.add('listening');
      button.disabled = true;
      recognition.onresult = (event) => {
        const spoken = event.results?.[0]?.[0]?.transcript || '';
        if (target) {
          if (target.tagName === 'TEXTAREA' && target.value.trim()) target.value += ' ' + spoken;
          else target.value = spoken;
          target.dispatchEvent(new Event('input', {bubbles:true}));
        }
      };
      recognition.onerror = () => {
        const status = button.closest('form')?.querySelector('.status-message') || $('logisticsStatus');
        showStatus(status, 'لم نتمكن من سماع الصوت. جرّب مرة أخرى أو استخدم لوحة المفاتيح.', 'error');
      };
      recognition.onend = () => {
        button.classList.remove('listening');
        button.disabled = false;
      };
      try { recognition.start(); }
      catch (_) {
        button.classList.remove('listening');
        button.disabled = false;
      }
    });
  });

  // Phone OTP login. Requires phone provider and SMS delivery to be enabled in Supabase.
  let phoneOtpRequested = false;
  $('phoneAuthForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const phone = $('authPhone').value.trim().replace(/[\\s().-]/g, '');
    if (!/^\\+[1-9]\\d{7,14}$/.test(phone)) {
      showStatus($('authStatus'), 'اكتب رقم الهاتف مع مفتاح الدولة، مثال: +213555123456', 'error');
      return;
    }
    const button = $('sendPhoneCode');
    button.disabled = true;
    try {
      const {error} = await db.auth.signInWithOtp({phone});
      if (error) throw error;
      phoneOtpRequested = true;
      $('phoneCodeLabel').hidden = false;
      $('verifyPhoneCode').hidden = false;
      showStatus($('authStatus'), 'تم طلب رمز SMS. أدخل الرمز الذي وصلك.', 'success');
    } catch (error) {
      showStatus($('authStatus'), 'تعذر إرسال الرمز. قد تحتاج خدمة SMS إلى التفعيل في Supabase: ' + (error?.message || 'خطأ غير معروف'), 'error');
    } finally { button.disabled = false; }
  });
  $('verifyPhoneCode').addEventListener('click', async () => {
    if (!phoneOtpRequested) return;
    const phone = $('authPhone').value.trim().replace(/[\\s().-]/g, '');
    const token = $('authPhoneCode').value.trim();
    if (!/^\\d{6}$/.test(token)) {
      showStatus($('authStatus'), 'أدخل رمز التحقق المكوّن من 6 أرقام.', 'error');
      return;
    }
    const button = $('verifyPhoneCode');
    button.disabled = true;
    try {
      const {data, error} = await db.auth.verifyOtp({phone, token, type:'sms'});
      if (error) throw error;
      updateAuthUI(data.user);
      showStatus($('authStatus'), 'تم تسجيل الدخول بنجاح.', 'success');
    } catch (error) {
      showStatus($('authStatus'), 'تعذر التحقق من الرمز: ' + (error?.message || 'خطأ غير معروف'), 'error');
    } finally { button.disabled = false; }
  });

  // Authentication: keep login, registration, password reset and logout accessible.
  function setAuthMode(mode) {
    authMode = mode;
    $('signInMode').classList.toggle('active', mode === 'signin');
    $('signUpMode').classList.toggle('active', mode === 'signup');
    $('authSubmit').textContent = mode === 'signup' ? 'إنشاء حساب' : 'دخول';
    $('authPassword').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    showStatus($('authStatus'), mode === 'signup' ? 'أنشئ حسابًا ببريد إلكتروني وكلمة مرور.' : 'يمكنك الدخول برقم الهاتف أو بالبريد الإلكتروني.');
  }
  $('signInMode').addEventListener('click', () => setAuthMode('signin'));
  $('signUpMode').addEventListener('click', () => setAuthMode('signup'));

  function updateAuthUI(user) {
    currentUser = user || null;
    $('accountLabel').textContent = currentUser ? (currentUser.email || 'متصل') : 'زائر';
    $('authSubmit').hidden = !!currentUser;
    $('phoneAuthForm').hidden = !!currentUser;
    $('signOutButton').hidden = !currentUser;
    $('signInMode').disabled = !!currentUser;
    $('signUpMode').disabled = !!currentUser;
    $('authEmail').readOnly = !!currentUser;
    $('authPassword').hidden = !!currentUser;
    if (currentUser) {
      $('authEmail').value = currentUser.email || '';
      $('authPhone').value = currentUser.phone || '';
      $('authPassword').value = '';
      showStatus($('authStatus'), 'أنت متصل الآن. يمكنك نشر الحمولة وفتح الرسائل.', 'success');
      loadConversations();
    } else {
      $('authEmail').readOnly = false;
      $('authPassword').hidden = false;
      $('authPassword').required = true;
      showStatus($('authStatus'), 'لم تسجل الدخول. يمكنك تصفح العروض، ويلزم الدخول للنشر والمراسلة.');
      conversations = [];
      activeConversation = null;
      $('chatPanel').hidden = true;
      renderConversations();
    }
    // Re-render announcement actions when the login state changes.
    loadListings();
  }

  $('authForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!$('authForm').reportValidity()) return;
    const button = $('authSubmit');
    button.disabled = true;
    button.textContent = authMode === 'signup' ? 'جارٍ إنشاء الحساب…' : 'جارٍ الدخول…';
    try {
      const email = $('authEmail').value.trim();
      const password = $('authPassword').value;
      if (authMode === 'signup') {
        const {data, error} = await db.auth.signUp({
          email, password,
          options: {emailRedirectTo: window.location.origin + window.location.pathname}
        });
        if (error) throw error;
        if (data.session && data.user) updateAuthUI(data.user);
        else showStatus($('authStatus'), 'تم إنشاء الحساب. افتح بريدك الإلكتروني واضغط رابط التأكيد، ثم عد إلى التطبيق للدخول.', 'success');
      } else {
        const {data, error} = await db.auth.signInWithPassword({email, password});
        if (error) throw error;
        updateAuthUI(data.user);
      }
    } catch (error) {
      showStatus($('authStatus'), 'تعذر الدخول: ' + (error?.message || 'خطأ غير معروف'), 'error');
    } finally {
      button.disabled = false;
      if (!currentUser) button.textContent = authMode === 'signup' ? 'إنشاء حساب' : 'دخول';
    }
  });

  $('resetPassword').addEventListener('click', async () => {
    const email = $('authEmail').value.trim();
    if (!email) {
      showStatus($('authStatus'), 'اكتب بريدك الإلكتروني أولًا، ثم اضغط نسيت كلمة المرور.', 'error');
      $('authEmail').focus();
      return;
    }
    try {
      const {error} = await db.auth.resetPasswordForEmail(email, {redirectTo: window.location.origin + window.location.pathname});
      if (error) throw error;
      showStatus($('authStatus'), 'إذا كان البريد مسجلًا، ستصلك رسالة لإعادة تعيين كلمة المرور.', 'success');
    } catch (error) {
      showStatus($('authStatus'), 'تعذر إرسال الرابط: ' + (error?.message || 'خطأ غير معروف'), 'error');
    }
  });

  $('signOutButton').addEventListener('click', async () => {
    const button = $('signOutButton');
    button.disabled = true;
    try {
      const {error} = await db.auth.signOut();
      if (error) throw error;
      updateAuthUI(null);
      $('authEmail').value = '';
      $('authPassword').value = '';
      setAuthMode('signin');
      $('account').scrollIntoView({behavior:'smooth'});
    } catch (error) {
      showStatus($('authStatus'), 'تعذر الخروج: ' + (error?.message || 'خطأ غير معروف'), 'error');
    } finally {
      button.disabled = false;
    }
  });

  // Transport listings use the existing annonces table and current RLS rules.
  function renderListing(row) {
    const carrier = row.type_annonce === 'offre_transport';
    const title = carrier ? 'شاحنة متاحة' : 'طلب نقل';
    const subtitle = carrier
      ? (row.type_camion || 'نوع الشاحنة غير محدد') + ' · ' + (row.quantite_tonnes ?? '—') + ' طن'
      : (row.marchandise || 'البضاعة غير محددة') + ' · ' + (row.quantite_tonnes ?? '—') + ' طن';
    const info = String(row.informations || '');
    const dateMatch = info.match(/Date : ([^|]+)/);
    const priceMatch = info.match(/(?:Prix souhaité|Budget indicatif) : ([^|]+)/);
    const extra = info.split('|').map((part) => part.trim()).filter((part) => !/^Date :|^Prix souhaité :|^Budget indicatif :/.test(part)).join(' · ');
    const card = document.createElement('article');
    card.className = 'listing-card';
    const call = String(row.telephone || '').trim();
    card.innerHTML = `
      <div class="listing-top">
        <span class="listing-kind ${carrier ? '' : 'request'}">${carrier ? '🚛 شاحنة' : '📦 حمولة'}</span>
        <div class="listing-main"><h3>${safe(row.ville_depart || '؟')} ← ${safe(row.ville_arrivee || '؟')}</h3><p>${safe(subtitle)}</p></div>
      </div>
      <div class="listing-facts">
        <span class="fact">📅 ${safe(dateText(dateMatch ? dateMatch[1].trim() : ''))}</span>
        <span class="fact">💰 ${safe(priceMatch ? priceMatch[1].trim() : 'السعر بالتفاوض')}</span>
        ${extra ? '<span class="fact">📝 ' + safe(extra) + '</span>' : ''}
      </div>
      <div class="listing-actions">
        ${call ? '<a class="call-button" href="tel:' + safe(call.replace(/[^+\d]/g,'')) + '">📞 اتصال</a>' : ''}
        ${currentUser && row.user_id && row.user_id !== currentUser.id ? '<button type="button" data-chat-user="' + safe(row.user_id) + '" data-listing-id="' + safe(row.id) + '">💬 مراسلة</button>' : ''}
        ${currentUser && row.user_id === currentUser.id ? '<span class="fact">إعلانك</span>' : ''}
        ${!currentUser ? '<a href="#account">🔐 دخول للمراسلة</a>' : ''}
      </div>`;
    const messageButton = card.querySelector('[data-chat-user]');
    messageButton?.addEventListener('click', () => startConversation(row));
    return card;
  }

  async function loadListings() {
    const container = $('logisticsListings');
    container.innerHTML = '<p class="empty-state">جارٍ تحميل الإعلانات…</p>';
    const {data, error} = await db.from('annonces').select('*').order('created_at', {ascending:false}).limit(100);
    if (error) {
      container.innerHTML = '';
      showStatus($('logisticsStatus'), 'تعذر تحميل الإعلانات: ' + error.message, 'error');
      container.innerHTML = '<p class="empty-state">تعذر تحميل العروض. تحقق من اتصال الإنترنت.</p>';
      return;
    }
    announcements = data || [];
    container.innerHTML = '';
    if (!announcements.length) {
      container.innerHTML = '<p class="empty-state">لا توجد عروض بعد. كن أول من ينشر شاحنة أو طلب نقل.</p>';
      return;
    }
    announcements.forEach((row) => container.appendChild(renderListing(row)));
  }
  $('refreshListings').addEventListener('click', loadListings);

  async function publishTransport(form, type) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (!currentUser) {
        showStatus($('logisticsStatus'), 'سجّل الدخول أولًا حتى نربط الإعلان بحسابك.', 'error');
        $('account').scrollIntoView({behavior:'smooth'});
        return;
      }
      const values = Object.fromEntries(new FormData(form).entries());
      const carrier = type === 'carrier';
      const button = form.querySelector('button[type="submit"]');
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'جارٍ النشر…';
      showStatus($('logisticsStatus'), 'جارٍ حفظ الإعلان…');
      const info = [
        'Date : ' + (values.date || 'À convenir'),
        (carrier ? 'Prix souhaité' : 'Budget indicatif') + ' : ' + (values[carrier ? 'price' : 'budget'] ? Number(values[carrier ? 'price' : 'budget']).toLocaleString('fr-FR') + ' DA' : 'À négocier')
      ];
      const details = carrier ? values.cargo : values.details;
      if (details?.trim()) info.push(details.trim());
      const row = {
        user_id: currentUser.id,
        type_annonce: carrier ? 'offre_transport' : 'demande_transport',
        ville_depart: values.origin.trim(),
        ville_arrivee: values.destination.trim(),
        marchandise: carrier ? (values.cargo?.trim() || 'À préciser') : values.cargoType,
        quantite_tonnes: Number(carrier ? values.capacity : values.weight),
        type_camion: carrier ? values.vehicle : null,
        telephone: values.phone.trim(),
        informations: info.join(' | ')
      };
      try {
        const {error} = await db.from('annonces').insert(row);
        if (error) throw error;
        showStatus($('logisticsStatus'), 'تم نشر إعلانك بنجاح ✅', 'success');
        form.reset();
        await loadListings();
        $('loads').scrollIntoView({behavior:'smooth'});
      } catch (error) {
        showStatus($('logisticsStatus'), 'لم يُنشر الإعلان: ' + (error?.message || 'خطأ غير معروف'), 'error');
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  }
  publishTransport($('carrierForm'), 'carrier');
  publishTransport($('shipperForm'), 'shipper');

  // Private chat uses chat_conversations/chat_messages with the existing participant RLS policies.
  function renderConversations() {
    const container = $('conversationList');
    container.innerHTML = '';
    if (!currentUser) {
      container.innerHTML = '<p class="empty-state">سجّل الدخول لعرض رسائلك.</p>';
      return;
    }
    if (!conversations.length) {
      container.innerHTML = '<p class="empty-state">لا توجد محادثات بعد. افتح إعلانًا واضغط «مراسلة» لبدء محادثة خاصة.</p>';
      return;
    }
    conversations.forEach((conversation) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'conversation-item';
      const peer = conversation.participant_one === currentUser.id ? conversation.participant_two : conversation.participant_one;
      item.innerHTML = '<span class="conversation-icon">💬</span><span><strong>محادثة نقل</strong><small>' + safe(conversation.context || 'محادثة مع مستخدم MetaLink') + '</small></span><span aria-hidden="true">←</span>';
      item.addEventListener('click', () => openConversation(conversation, peer));
      container.appendChild(item);
    });
  }

  async function loadConversations() {
    if (!currentUser) return;
    const {data, error} = await db.from('chat_conversations').select('*').order('created_at', {ascending:false});
    if (error) {
      showStatus($('chatStatus'), 'تعذر تحميل المحادثات: ' + error.message, 'error');
      return;
    }
    conversations = data || [];
    renderConversations();
  }

  async function startConversation(listing) {
    if (!currentUser) {
      showStatus($('authStatus'), 'سجّل الدخول أولًا حتى تراسل صاحب الإعلان.', 'error');
      $('account').scrollIntoView({behavior:'smooth'});
      return;
    }
    if (!listing.user_id || listing.user_id === currentUser.id) return;
    const button = document.querySelector('[data-chat-user="' + CSS.escape(listing.user_id) + '"]');
    if (button) { button.disabled = true; button.textContent = 'جارٍ فتح المحادثة…'; }
    try {
      await loadConversations();
      let conversation = conversations.find((item) =>
        (item.participant_one === currentUser.id && item.participant_two === listing.user_id) ||
        (item.participant_two === currentUser.id && item.participant_one === listing.user_id)
      );
      if (!conversation) {
        const context = 'نقل: ' + (listing.ville_depart || '؟') + ' → ' + (listing.ville_arrivee || '؟');
        const {data, error} = await db.from('chat_conversations').insert({
          participant_one: currentUser.id,
          participant_two: listing.user_id,
          created_by: currentUser.id,
          context
        }).select('*').single();
        if (error) throw error;
        conversation = data;
        conversations.unshift(conversation);
      }
      await openConversation(conversation, listing.user_id);
      $('messages').scrollIntoView({behavior:'smooth'});
    } catch (error) {
      showStatus($('logisticsStatus'), 'تعذر فتح المحادثة: ' + (error?.message || 'تحقق من صلاحيات الدردشة'), 'error');
    } finally {
      if (button) { button.disabled = false; button.textContent = '💬 مراسلة'; }
    }
  }

  async function openConversation(conversation, peerId) {
    activeConversation = conversation;
    $('chatPanel').hidden = false;
    $('chatTitle').textContent = 'محادثة نقل';
    $('chatSubtitle').textContent = conversation.context || 'محادثة خاصة';
    await loadMessages();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (activeConversation?.id === conversation.id) loadMessages(true);
    }, 10000);
  }

  async function loadMessages(quiet = false) {
    if (!activeConversation || !currentUser) return;
    if (!quiet) $('chatMessages').innerHTML = '<p class="empty-state">جارٍ تحميل الرسائل…</p>';
    const {data, error} = await db.from('chat_messages').select('*').eq('conversation_id', activeConversation.id).order('created_at', {ascending:true});
    if (error) {
      showStatus($('chatStatus'), 'تعذر تحميل الرسائل: ' + error.message, 'error');
      if (!quiet) $('chatMessages').innerHTML = '<p class="empty-state">تعذر تحميل الرسائل.</p>';
      return;
    }
    const container = $('chatMessages');
    const previousCount = container.querySelectorAll('.message').length;
    container.innerHTML = '';
    if (!data?.length) {
      container.innerHTML = '<p class="empty-state">ابدأ المحادثة برسالة قصيرة.</p>';
      return;
    }
    data.forEach((message) => {
      const item = document.createElement('div');
      item.className = 'message' + (message.sender_id === currentUser.id ? ' mine' : '');
      const time = message.created_at ? new Date(message.created_at).toLocaleTimeString('ar-DZ', {hour:'2-digit',minute:'2-digit'}) : '';
      item.innerHTML = '<p>' + safe(message.body) + '</p><time>' + safe(time) + '</time>';
      container.appendChild(item);
    });
    if (!quiet || data.length !== previousCount) container.scrollTop = container.scrollHeight;
    showStatus($('chatStatus'), '');
  }

  $('refreshConversations').addEventListener('click', loadConversations);
  $('refreshMessages').addEventListener('click', () => loadMessages());
  $('backToConversations').addEventListener('click', () => {
    activeConversation = null;
    $('chatPanel').hidden = true;
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
  });

  $('chatForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = $('chatInput').value.trim();
    if (!body || !activeConversation || !currentUser) {
      showStatus($('chatStatus'), 'افتح محادثة بعد تسجيل الدخول أولًا.', 'error');
      return;
    }
    const button = $('chatForm').querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const {error} = await db.from('chat_messages').insert({
        conversation_id: activeConversation.id,
        sender_id: currentUser.id,
        body
      });
      if (error) throw error;
      $('chatInput').value = '';
      await loadMessages();
    } catch (error) {
      showStatus($('chatStatus'), 'لم تُرسل الرسالة: ' + (error?.message || 'خطأ غير معروف'), 'error');
    } finally {
      button.disabled = false;
    }
  });

  // Advertising requests remain available, but do not distract from the transport workflow.
  $('adRequestForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = $('adRequestForm');
    if (!form.reportValidity()) return;
    if (!currentUser) {
      showStatus($('adRequestStatus'), 'سجّل الدخول أولًا لإرسال طلب الإشهار.', 'error');
      $('account').scrollIntoView({behavior:'smooth'});
      return;
    }
    const values = Object.fromEntries(new FormData(form).entries());
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const {error} = await db.from('ad_requests').insert({
        user_id: currentUser.id,
        company_name: String(values.company || '').trim(),
        ad_type: String(values.adType || '').trim(),
        requested_style: String(values.style || '').trim(),
        brief: String(values.brief || '').trim(),
        contact_details: String(values.contact || '').trim(),
        status: 'pending'
      });
      if (error) throw error;
      showStatus($('adRequestStatus'), 'تم حفظ طلب الإشهار بنجاح، وهو الآن قيد المراجعة.', 'success');
      form.reset();
    } catch (error) {
      showStatus($('adRequestStatus'), 'تعذر حفظ طلب الإشهار: ' + (error?.message || 'خطأ غير معروف'), 'error');
    } finally {
      button.disabled = false;
    }
  });

  $('refreshListings').addEventListener('click', loadListings);
  db.auth.getSession().then(({data, error}) => {
    if (error) showStatus($('authStatus'), 'تعذر استعادة الجلسة: ' + error.message, 'error');
    updateAuthUI(data?.session?.user || null);
  });
  db.auth.onAuthStateChange((_event, session) => updateAuthUI(session?.user || null));
  loadListings();

  // Native install prompt when supported by the browser.
  let deferredInstallPrompt = null;
  const installButton = $('installApp');
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installButton) installButton.hidden = false;
  });
  installButton?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      showStatus($('authStatus'), 'إذا لم يظهر التثبيت هنا، افتح قائمة المتصفح ثم اختر «إضافة إلى الشاشة الرئيسية».');
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });
  window.addEventListener('appinstalled', () => { if (installButton) installButton.hidden = true; });

  // Register the installable-app service worker on HTTPS hosts such as GitHub Pages.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();