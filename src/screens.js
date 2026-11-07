/* Theme-driven specimens. Demo interactions intentionally stay in memory. */
(function (global) {
  'use strict';
  const demo = {cart: [0, 0, 0, 0], category: 'all', bookmarked: false, readingSize: 1,
    mobileTab: 'today', habits: [false, true, false], galleryTab: 'overview',
    notifications: true, mobileReminder: true, toastVisible: true, workspace: 'Studio workspace'};
  const bindings = new WeakMap();
  const products = [
    {name: 'Everyday cup', tag: 'Hand-finished ceramic', price: 24, type: 'home', art: 'cup'},
    {name: 'Quiet hours', tag: 'Linen-bound notebook', price: 18, type: 'desk', art: 'book'},
    {name: 'Arc table lamp', tag: 'A softer evening light', price: 89, type: 'home', art: 'lamp'},
    {name: 'Desk collection', tag: 'Three useful essentials', price: 36, type: 'desk', art: 'stationery'}
  ];
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function icon(name) {
    const paths = {bag:'M6 7h12l1 13H5L6 7Zm3 0V5a3 3 0 0 1 6 0v2',
      bookmark:'M6 3h12v18l-6-4-6 4V3Z', arrow:'M5 12h14m-6-6 6 6-6 6',
      sun:'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0-6v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
      chart:'M5 20V10m7 10V4m7 16v-7', person:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 21v-2a7 7 0 0 1 14 0v2', check:'m5 12 4 4L19 6'};
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.arrow}"/></svg>`;
  }
  function context(ctx) {
    const e = ctx.escapeHTML || escape;
    return {...ctx, mode: ctx.mode === 'dark' ? 'dark' : 'light', e};
  }
  function feedback(ctx, type) {
    const source = ctx.semantic?.[ctx.mode]?.[type] || ctx.semantic?.[type] || {};
    const valid = s => /^#[0-9a-f]{6}$/i.test(s || '');
    return `--feedback-fg:${valid(source.fg) ? source.fg : ctx.tokens.text};--feedback-bg:${valid(source.bg) ? source.bg : ctx.tokens.surface}`;
  }
  const cartCount = () => demo.cart.reduce((a, b) => a + b, 0);
  const cartTotal = () => demo.cart.reduce((a, n, i) => a + n * products[i].price, 0);

  function shopping(ctx) {
    const {e, mode} = context(ctx);
    return `<div class="screen-shell screen-shop" data-screen="shopping">
      <div class="screen-top"><div class="screen-brand"><span class="screen-brand-symbol" aria-hidden="true"></span>FORM & FIELD</div><button class="screen-icon-button" type="button" data-cart-open aria-label="Show sample bag">${icon('bag')}<span data-cart-count>${cartCount()}</span></button></div>
      <div class="screen-shop-hero"><span class="screen-kicker">Objects for the everyday</span><h3>A little less.<br>A little better.</h3><p>Thoughtful pieces, made to be part of your day.</p><button class="screen-text-button" type="button" data-shop-explore>Explore the collection ${icon('arrow')}</button><div class="screen-hero-sculpture" aria-hidden="true"><i></i><i></i><i></i></div></div>
      <div class="screen-section-heading"><div><span class="screen-kicker">THE CONSIDERED COLLECTION</span><h4>Made to stay.</h4></div><span class="screen-count"><span data-product-count>${demo.category === 'all' ? '4' : '2'}</span> pieces</span></div>
      <div class="screen-filters" role="group" aria-label="${mode} shop category">${[['all','All pieces'],['home','For home'],['desk','For your desk']].map(([key,label]) => `<button type="button" data-shop-category="${key}" aria-pressed="${demo.category === key}">${label}</button>`).join('')}</div>
      <div class="screen-products" data-shop-products>${products.map((p,i) => `<article class="screen-product" data-product-type="${p.type}" ${demo.category !== 'all' && demo.category !== p.type ? 'hidden' : ''}><div class="screen-product-art screen-art-${p.art}" aria-hidden="true"><i></i><b></b><span></span></div><div class="screen-product-copy"><h5>${p.name}</h5><p>${p.tag}</p><div class="screen-product-bottom"><span class="screen-price">$${p.price}</span><button class="screen-btn screen-btn-small" data-shop-add="${i}" type="button" aria-label="Add ${p.name} to sample bag">Add to bag</button></div></div></article>`).join('')}</div>
      <div class="screen-bag-summary" data-bag-summary tabindex="-1"><div><strong>Your sample bag</strong><span><span data-cart-count>${cartCount()}</span> <span data-cart-noun>${cartCount()===1?'item':'items'}</span> · <span data-cart-total>$${cartTotal()}</span></span></div><button class="screen-btn screen-btn-outline" data-cart-reset type="button">Clear bag</button></div>
      <p class="screen-demo-note">Shopping specimen. No checkout or payment is connected.</p>
    </div>`;
  }
  function reading(ctx) {
    const {mode} = context(ctx);
    return `<div class="screen-shell screen-reading" data-screen="reading">
      <div class="screen-top"><div class="screen-brand screen-reading-brand">SLOW NOTES<span>Ideas worth staying with.</span></div><button class="screen-icon-button" type="button" data-bookmark aria-pressed="${demo.bookmarked}" aria-label="Bookmark this sample article">${icon('bookmark')}</button></div>
      <div class="screen-reading-meta"><span class="screen-kicker">DESIGN & EVERYDAY LIFE</span><span>6 min read</span></div>
      <h3 class="screen-article-title">The art of<br>making room.</h3><p class="screen-article-deck">On attention, useful things, and finding a little more space for what matters.</p>
      <div class="screen-author"><span class="screen-author-mark" aria-hidden="true">JL</span><div><strong>Jamie Lee</strong><span>November 8, 2026 · Sample article</span></div></div>
      <div class="screen-reading-illustration" aria-hidden="true"><i></i><b></b><span></span></div>
      <div class="screen-reading-toolbar"><span data-reading-save-status>${demo.bookmarked ? '✓ Saved to your reading list' : 'Your next quiet moment'}</span><div class="screen-type-controls" role="group" aria-label="${mode} article text size"><button type="button" data-reading-size="-1" aria-label="Decrease article text size" ${demo.readingSize <= .9 ? 'disabled' : ''}>A−</button><output data-reading-size-label>${Math.round(demo.readingSize * 100)}%</output><button type="button" data-reading-size="1" aria-label="Increase article text size" ${demo.readingSize >= 1.3 ? 'disabled' : ''}>A+</button></div></div>
      <article class="screen-reader" style="font-size:${demo.readingSize}em"><p>We often imagine that a better day needs more: another tool, another plan, another carefully arranged list. Sometimes it begins with the opposite.</p><p>Making room is a small act of attention. It means noticing the objects we reach for, the words we return to, and the moments that help us feel present.</p><blockquote>“Keep what supports the life you want to live.”</blockquote><h4>Begin with one useful thing.</h4><p>A clear table. A page left open. A cup you like holding. Good design gives these ordinary moments enough space to become visible.</p></article>
      <div class="screen-reading-next"><span class="screen-kicker">UP NEXT</span><h4>Small rituals, lasting ideas.</h4><button class="screen-text-button" type="button" data-screen-notice="The next article is a specimen link; no navigation is connected.">Preview next story ${icon('arrow')}</button></div>
    </div>`;
  }
  function mobile(ctx) {
    const {mode} = context(ctx);
    const completed = demo.habits.filter(Boolean).length;
    return `<div class="screen-shell screen-mobile" data-screen="mobile">
      <div class="screen-mobile-status" aria-hidden="true"><strong>9:41</strong><span>● ● ● ▰</span></div>
      <div class="screen-mobile-head"><span class="screen-kicker">SUNDAY, NOVEMBER 8</span><div><h3>A softer start.</h3><span class="screen-avatar" aria-hidden="true">A</span></div><p>One small step is enough for today.</p></div>
      <div class="screen-mobile-panel" data-mobile-panel="today" ${demo.mobileTab !== 'today' ? 'hidden' : ''}>
        <section class="screen-focus-card"><span class="screen-kicker">TODAY’S INTENTION</span><h4>Make time<br>for yourself.</h4><p>Ten minutes, with nothing else open.</p><button type="button" class="screen-btn" data-mobile-focus>Start a quiet moment ${icon('arrow')}</button></section>
        <div class="screen-section-heading"><h4>Your daily rhythm</h4><span data-habit-count>${completed} of 3 done</span></div>
        <div class="screen-habits">${[['A glass of water','A fresh beginning'],['Read a few pages','A different perspective'],['Step outside','A little space to breathe']].map(([title,sub],i) => `<label class="screen-habit" for="habit-${mode}-${i}"><input id="habit-${mode}-${i}" type="checkbox" data-mobile-habit="${i}" ${demo.habits[i] ? 'checked' : ''}><span><strong>${title}</strong><small>${sub}</small></span><span class="screen-habit-indicator" aria-hidden="true">${demo.habits[i] ? '✓' : ''}</span></label>`).join('')}</div>
        <div class="screen-mini-progress"><span data-habit-progress-label>${Math.round(completed / 3 * 100)}% of today’s habits complete</span><div role="progressbar" aria-label="Daily habit completion" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${completed}" data-habit-progress><i style="width:${completed / 3 * 100}%"></i></div></div>
      </div>
      <div class="screen-mobile-panel" data-mobile-panel="progress" ${demo.mobileTab !== 'progress' ? 'hidden' : ''}><section class="screen-mobile-progress"><span class="screen-kicker">THIS WEEK</span><h4>Consistency feels good.</h4><strong class="screen-big-number">5<span>gentle days</span></strong><p>Small steps count. Here is a sample week of completed habits.</p><div class="screen-week" role="img" aria-label="Completed habits: Monday 2, Tuesday 3, Wednesday 1, Thursday 3, Friday 3, Saturday 0, Sunday 2">${[2,3,1,3,3,0,2].map((n,i) => `<div><span>${n}</span><i style="height:${n*18}px"></i><small>${['M','T','W','T','F','S','S'][i]}</small></div>`).join('')}</div></section></div>
      <div class="screen-mobile-panel" data-mobile-panel="you" ${demo.mobileTab !== 'you' ? 'hidden' : ''}><section class="screen-mobile-profile"><span class="screen-avatar">A</span><h4>Alex’s quiet corner.</h4><p>This sample profile lets you compare identity, settings, and reading text in the same theme.</p><label for="mobile-reminder-${mode}" class="screen-setting"><span>A gentle daily reminder</span><input id="mobile-reminder-${mode}" type="checkbox" data-mobile-reminder ${demo.mobileReminder?'checked':''}></label><button class="screen-btn screen-btn-outline" type="button" data-screen-notice="Profile preferences are a preview and are not saved.">Preview preferences</button></section></div>
      <nav class="screen-bottom-nav" aria-label="${mode} sample mobile navigation">${[['today','sun','Today'],['progress','chart','Progress'],['you','person','You']].map(([key,glyph,label]) => `<button type="button" data-mobile-tab="${key}" aria-pressed="${demo.mobileTab === key}">${icon(glyph)}<span>${label}</span>${demo.mobileTab === key ? '<i aria-hidden="true"></i>' : ''}</button>`).join('')}</nav>
      <p class="screen-demo-note">Mobile app specimen · sample data · session-only interactions</p>
    </div>`;
  }

  function galleryPanel(tab) {
    const content = {
      overview: ['Everything in view.', '12 active items · 3 ready for review'],
      activity: ['A clear record of progress.', 'Design approved · References updated'],
      details: ['The useful details.', 'Owner: Alex Kim · Status: In progress']
    };
    return `<strong>${content[tab][0]}</strong><span>${content[tab][1]}</span>`;
  }
  function gallery(ctx) {
    ctx = context(ctx); const {mode,e} = ctx;
    return `<div class="gallery-shell" data-gallery-mode="${mode}">
      <div class="gallery-heading"><span class="screen-kicker">COMPONENT GALLERY / ${mode.toUpperCase()}</span><h3>The details of a theme.</h3><p>Real controls, paired tokens, and labeled interaction states.</p></div>
      <section class="gallery-section"><h4>Buttons & interaction states</h4><p class="gallery-description">Hover, pressed and focus specimens stay visible for comparison. Keyboard focus still works on every active control.</p><div class="gallery-buttons">${[['default','Default'],['hover','Hover'],['pressed','Pressed'],['focus','Focus'],['disabled','Disabled']].map(([key,label]) => `<button type="button" class="screen-btn gallery-button-${key}" ${key === 'disabled' ? 'disabled' : `data-screen-notice="${label} button specimen activated."`}>${label}</button>`).join('')}</div><div class="gallery-buttons gallery-secondary-buttons"><button type="button" class="screen-btn screen-btn-outline" data-screen-notice="Secondary action preview.">Secondary action</button><button type="button" class="screen-text-button" data-screen-notice="Text link preview.">Underlined link ${icon('arrow')}</button><button type="button" class="screen-btn" data-gallery-dialog>Open themed dialog</button></div></section>
      <div class="gallery-grid"><section class="gallery-section"><h4>Inputs & validation</h4><form data-gallery-form><label class="gallery-field" for="gallery-name-${mode}"><span>Workspace name</span><input id="gallery-name-${mode}" value="${e(demo.workspace)}" maxlength="60" required data-gallery-name></label><label class="gallery-field gallery-field-error" for="gallery-error-${mode}" style="${feedback(ctx,'error')}"><span>Email address</span><input id="gallery-error-${mode}" value="alex@" type="email" aria-invalid="true" aria-describedby="gallery-error-help-${mode}" data-gallery-email><small id="gallery-error-help-${mode}" data-gallery-error-help>× Enter a complete email address.</small></label><label class="gallery-field" for="gallery-disabled-${mode}"><span>Read-only plan setting</span><input id="gallery-disabled-${mode}" value="Managed by your team" disabled></label><button class="screen-btn screen-btn-outline" type="submit">Preview save</button></form></section>
      <section class="gallery-section"><h4>Selection controls</h4><label class="gallery-choice" for="gallery-check-${mode}"><input type="checkbox" id="gallery-check-${mode}" checked><span>Include completed items</span></label><label class="gallery-choice" for="gallery-check-off-${mode}"><input type="checkbox" id="gallery-check-off-${mode}"><span>Show archived items</span></label><fieldset class="gallery-radio-group"><legend>Display density</legend><label class="gallery-choice" for="gallery-radio-comfort-${mode}"><input type="radio" name="gallery-density-${mode}" value="comfortable" id="gallery-radio-comfort-${mode}" checked><span>Comfortable</span></label><label class="gallery-choice" for="gallery-radio-compact-${mode}"><input type="radio" name="gallery-density-${mode}" value="compact" id="gallery-radio-compact-${mode}"><span>Compact</span></label></fieldset><div class="gallery-switch-row"><span>Activity notifications</span><button class="gallery-switch" type="button" role="switch" aria-checked="${demo.notifications}" aria-label="${mode} activity notifications" data-gallery-switch><i aria-hidden="true"></i><span>${demo.notifications ? 'On' : 'Off'}</span></button></div><label class="gallery-choice" for="gallery-check-disabled-${mode}"><input type="checkbox" id="gallery-check-disabled-${mode}" disabled><span>Unavailable option</span></label></section></div>
      <section class="gallery-section"><h4>Navigation & selected state</h4><div class="gallery-tabs" role="tablist" aria-label="${mode} component navigation">${[['overview','Overview'],['activity','Activity'],['details','Details']].map(([key,label]) => `<button type="button" role="tab" id="gallery-tab-${mode}-${key}" data-gallery-tab="${key}" aria-selected="${demo.galleryTab===key}" aria-controls="gallery-panel-${mode}" tabindex="${demo.galleryTab===key ? 0 : -1}">${label}</button>`).join('')}</div><div class="gallery-tab-panel" role="tabpanel" id="gallery-panel-${mode}" tabindex="0" aria-labelledby="gallery-tab-${mode}-${demo.galleryTab}" data-gallery-panel>${galleryPanel(demo.galleryTab)}</div></section>
      <section class="gallery-section"><h4>Table & numeric content</h4><div class="gallery-table-wrap"><table class="gallery-table"><caption class="sr-only">Sample workspace plans</caption><thead><tr><th scope="col">Workspace</th><th scope="col">Status</th><th scope="col">Items</th></tr></thead><tbody>${[['Brand library','✓ Ready','24'],['App interface','In review','18'],['Research notes','Draft','08']].map(row=>`<tr><th scope="row">${row[0]}</th><td><span class="gallery-status-pill">${row[1]}</span></td><td>${row[2]}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="gallery-section"><h4>Charts & meaningful marks</h4><p class="gallery-description">Direct labels support the color encoding. The bars use primary against surface.</p><div class="gallery-chart" role="img" aria-label="Sample completed tasks: Plan 24, Design 36, Build 18, Review 30">${[['Plan',24],['Design',36],['Build',18],['Review',30]].map(([label,n])=>`<div><strong>${n}</strong><i style="height:${n*2}px"></i><span>${label}</span></div>`).join('')}</div><div class="gallery-progress"><div><span>Project completion</span><strong>62%</strong></div><div role="progressbar" aria-label="Sample project completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="62"><i></i></div></div></section>
      <section class="gallery-section"><h4>Feedback & notifications</h4><div class="gallery-alerts">${[['success','✓','Saved successfully','Your changes are ready.'],['warning','!','Review before continuing','Two fields need your attention.'],['error','×','We could not save this','Check the highlighted fields.'],['info','i','A helpful update','Your preview is ready to share.']].map(([key,mark,title,body])=>`<div class="gallery-alert" style="${feedback(ctx,key)}"><span aria-hidden="true">${mark}</span><div><strong>${title}</strong><p>${body}</p></div></div>`).join('')}</div><div class="gallery-toast" data-gallery-toast ${demo.toastVisible ? '' : 'hidden'} style="${feedback(ctx,'success')}"><span>✓ Workspace saved. This is a toast specimen.</span><button type="button" data-gallery-dismiss aria-label="Dismiss ${mode} sample notification">Dismiss</button></div></section>
      <section class="gallery-section"><h4>Dialog anatomy</h4><div class="gallery-dialog-specimen"><span class="screen-kicker">STATIC SPECIMEN</span><h5>Keep your changes?</h5><p>A clear title, concise explanation, and distinct actions make decisions easier.</p><div class="gallery-dialog-actions"><button type="button" class="screen-btn screen-btn-outline" data-screen-notice="Cancel action preview.">Cancel</button><button type="button" class="screen-btn" data-gallery-dialog>Review changes</button></div></div></section>
      <dialog class="gallery-dialog" id="gallery-dialog-${mode}" aria-labelledby="gallery-dialog-title-${mode}"><form data-gallery-dialog-form><span class="screen-kicker">THEMED DIALOG</span><h2 id="gallery-dialog-title-${mode}">Make it yours.</h2><p>This dialog inherits the current colors and fonts. Escape closes it; focus returns to the opening control.</p><label for="gallery-dialog-name-${mode}">Workspace name</label><input id="gallery-dialog-name-${mode}" value="${e(demo.workspace)}" maxlength="60" required data-gallery-dialog-name><div class="gallery-dialog-actions"><button class="screen-btn screen-btn-outline" type="button" data-gallery-close>Cancel</button><button class="screen-btn" type="submit">Save sample</button></div></form></dialog>
      <p class="screen-demo-note">A token audit checks the listed color pairs. It does not certify full application accessibility.</p>
    </div>`;
  }

  function render(template, ctx) {
    if (template === 'shopping') return shopping(ctx);
    if (template === 'reading') return reading(ctx);
    if (template === 'mobile') return mobile(ctx);
    return '';
  }
  const all = (root, selector) => [...root.querySelectorAll(selector)];
  function updateMobile(root) {
    const done = demo.habits.filter(Boolean).length;
    all(root,'[data-mobile-habit]').forEach(input => {input.checked=demo.habits[+input.dataset.mobileHabit];input.closest('.screen-habit').querySelector('.screen-habit-indicator').textContent=input.checked?'✓':'';});
    all(root,'[data-habit-count]').forEach(el=>el.textContent=`${done} of 3 done`);
    all(root,'[data-habit-progress-label]').forEach(el=>el.textContent=`${Math.round(done/3*100)}% of today’s habits complete`);
    all(root,'[data-habit-progress]').forEach(el=>{el.setAttribute('aria-valuenow',done);el.firstElementChild.style.width=`${done/3*100}%`;});
  }
  function bind(root, options={}) {
    if (!root) return;
    if (bindings.has(root)) {bindings.set(root,options);return;}
    bindings.set(root,options);
    const notice=message=>bindings.get(root)?.onNotice?.(message);
    root.addEventListener('click',event=>{
      const button=event.target.closest('button');
      if (!button || !root.contains(button) || button.disabled) return;
      if (button.hasAttribute('data-shop-add')) {
        demo.cart[+button.dataset.shopAdd]++;
        all(root,'[data-cart-count]').forEach(el=>el.textContent=cartCount());
        all(root,'[data-cart-noun]').forEach(el=>el.textContent=cartCount()===1?'item':'items');
        all(root,'[data-cart-total]').forEach(el=>el.textContent='$'+cartTotal());
        notice(`${products[+button.dataset.shopAdd].name} added to the sample bag.`);
      } else if (button.hasAttribute('data-cart-reset')) {
        demo.cart.fill(0);all(root,'[data-cart-count]').forEach(el=>el.textContent='0');all(root,'[data-cart-noun]').forEach(el=>el.textContent='items');all(root,'[data-cart-total]').forEach(el=>el.textContent='$0');notice('Sample bag cleared.');
      } else if (button.hasAttribute('data-cart-open')) {
        const summary=button.closest('[data-screen]').querySelector('[data-bag-summary]');summary.focus({preventScroll:true});summary.scrollIntoView({block:'nearest'});notice(`Sample bag: ${cartCount()} ${cartCount()===1?'item':'items'}, $${cartTotal()}.`);
      } else if (button.hasAttribute('data-shop-category')) {
        demo.category=button.dataset.shopCategory;
        all(root,'[data-shop-category]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.shopCategory===demo.category));
        all(root,'[data-product-type]').forEach(el=>el.hidden=demo.category!=='all'&&el.dataset.productType!==demo.category);
        all(root,'[data-product-count]').forEach(el=>el.textContent=demo.category==='all'?'4':'2');
      } else if (button.hasAttribute('data-shop-explore')) {
        const target=button.closest('[data-screen]').querySelector('[data-shop-category]');target.focus({preventScroll:true});target.scrollIntoView({block:'nearest'});
      } else if (button.hasAttribute('data-bookmark')) {
        demo.bookmarked=!demo.bookmarked;all(root,'[data-bookmark]').forEach(el=>el.setAttribute('aria-pressed',demo.bookmarked));all(root,'[data-reading-save-status]').forEach(el=>el.textContent=demo.bookmarked?'✓ Saved to your reading list':'Your next quiet moment');notice(demo.bookmarked?'Article bookmarked for this session.':'Bookmark removed.');
      } else if (button.hasAttribute('data-reading-size')) {
        demo.readingSize=Math.max(.9,Math.min(1.3,Math.round((demo.readingSize+(+button.dataset.readingSize)*.1)*10)/10));
        all(root,'.screen-reader').forEach(el=>el.style.fontSize=demo.readingSize+'em');all(root,'[data-reading-size-label]').forEach(el=>el.textContent=Math.round(demo.readingSize*100)+'%');all(root,'[data-reading-size]').forEach(el=>el.disabled=+el.dataset.readingSize<0?demo.readingSize<=.9:demo.readingSize>=1.3);
      } else if (button.hasAttribute('data-mobile-tab')) {
        demo.mobileTab=button.dataset.mobileTab;all(root,'[data-mobile-tab]').forEach(el=>{const on=el.dataset.mobileTab===demo.mobileTab;el.setAttribute('aria-pressed',on);el.querySelector('i')?.remove();if(on)el.insertAdjacentHTML('beforeend','<i aria-hidden="true"></i>');});all(root,'[data-mobile-panel]').forEach(el=>el.hidden=el.dataset.mobilePanel!==demo.mobileTab);
      } else if (button.hasAttribute('data-mobile-focus')) {
        notice('Quiet moment started. Take one slow breath; this preview does not run a timer.');
      } else if (button.hasAttribute('data-gallery-switch')) {
        demo.notifications=!demo.notifications;all(root,'[data-gallery-switch]').forEach(el=>{el.setAttribute('aria-checked',demo.notifications);el.querySelector('span').textContent=demo.notifications?'On':'Off';});
      } else if (button.hasAttribute('data-gallery-tab')) {
        demo.galleryTab=button.dataset.galleryTab;all(root,'[data-gallery-tab]').forEach(el=>{const on=el.dataset.galleryTab===demo.galleryTab;el.setAttribute('aria-selected',on);el.tabIndex=on?0:-1;});all(root,'[data-gallery-panel]').forEach(el=>{el.innerHTML=galleryPanel(demo.galleryTab);const selected=el.closest('[data-gallery-mode]').querySelector(`[data-gallery-tab="${demo.galleryTab}"]`);el.setAttribute('aria-labelledby',selected.id);});
      } else if (button.hasAttribute('data-gallery-dialog')) {
        const dialog=button.closest('[data-gallery-mode]').querySelector('.gallery-dialog');dialog.showModal();dialog.querySelector('input').focus();
      } else if (button.hasAttribute('data-gallery-close')) {
        button.closest('dialog').close();
      } else if (button.hasAttribute('data-gallery-dismiss')) {
        demo.toastVisible=false;all(root,'[data-gallery-toast]').forEach(el=>el.hidden=true);notice('Sample notification dismissed.');
      } else if (button.hasAttribute('data-screen-notice')) notice(button.dataset.screenNotice);
    });
    root.addEventListener('change',event=>{
      if(event.target.matches('[data-mobile-habit]')){demo.habits[+event.target.dataset.mobileHabit]=event.target.checked;updateMobile(root);}
      if(event.target.matches('[data-mobile-reminder]')){demo.mobileReminder=event.target.checked;all(root,'[data-mobile-reminder]').forEach(el=>el.checked=demo.mobileReminder);notice(demo.mobileReminder?'Sample reminder enabled.':'Sample reminder disabled.');}
    });
    root.addEventListener('input',event=>{
      if(event.target.matches('[data-gallery-email]')){
        const valid=event.target.value.trim()!==''&&event.target.validity.valid;
        event.target.setAttribute('aria-invalid',!valid);
        event.target.closest('.gallery-field').classList.toggle('gallery-field-error',!valid);
        event.target.closest('.gallery-field').querySelector('[data-gallery-error-help]').textContent=valid?'✓ Email format looks complete.':'× Enter a complete email address.';
      }
    });
    root.addEventListener('submit',event=>{
      const form=event.target;
      if(!form.matches('[data-gallery-form], [data-gallery-dialog-form]'))return;
      event.preventDefault();
      if(!form.reportValidity())return;
      const input=form.querySelector('[data-gallery-name], [data-gallery-dialog-name]');const name=input.value.trim();
      if(!name){input.setCustomValidity('Enter a workspace name.');input.reportValidity();input.addEventListener('input',()=>input.setCustomValidity(''),{once:true});return;}
      demo.workspace=name;all(root,'[data-gallery-name], [data-gallery-dialog-name]').forEach(el=>el.value=name);form.closest('dialog')?.close();notice('Sample workspace saved: '+name);
    });
    root.addEventListener('keydown',event=>{
      const button=event.target.closest('[data-gallery-tab]');if(!button||!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
      event.preventDefault();const tabs=[...button.parentElement.querySelectorAll('[data-gallery-tab]')],i=tabs.indexOf(button),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;tabs[next].click();tabs[next].focus();
    });
  }
  global.AtlasScreens={render,gallery,bind};
  if(typeof module!=='undefined'&&module.exports)module.exports=global.AtlasScreens;
})(typeof globalThis!=='undefined'?globalThis:window);
