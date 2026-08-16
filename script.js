/* =========================================================
   Мопсомания — интерактив лендинга
   Зависимостей нет. Скрипт подключён в конце <body>,
   поэтому DOM уже разобран.
   ========================================================= */

(function () {
  'use strict';

  var root = document.documentElement;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var desktopQuery = window.matchMedia('(min-width: 769px)');

  /* =======================================================
     1. ПЕРЕКЛЮЧАТЕЛЬ ТЕМЫ
     Начальная тема уже выставлена инлайн-скриптом в <head>,
     здесь только переключение и синхронизация состояния кнопки.
     ======================================================= */

  function initTheme() {
    var toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    function syncToggleState(theme) {
      var isDark = theme === 'dark';
      toggle.setAttribute('aria-pressed', String(isDark));
      toggle.setAttribute('aria-label', isDark ? 'Включить светлую тему' : 'Включить тёмную тему');
    }

    syncToggleState(root.getAttribute('data-theme'));

    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      syncToggleState(next);

      try {
        localStorage.setItem('theme', next);
      } catch (e) {
        /* Приватный режим: тема применится, но не сохранится */
      }
    });
  }

  /* =======================================================
     2. ТЕНЬ У ЛИПКОЙ ШАПКИ
     Порог в 40px задан высотой сентинела в CSS: пока он виден,
     страница прокручена меньше порога. Событие scroll не нужно.
     ======================================================= */

  function initHeaderShadow() {
    var header = document.getElementById('header');
    var sentinel = document.getElementById('scroll-sentinel');
    if (!header || !sentinel || !('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(function (entries) {
      header.classList.toggle('header--scrolled', !entries[0].isIntersecting);
    });

    observer.observe(sentinel);
  }

  /* =======================================================
     3. SCROLLSPY
     Пункт и секция связаны только совпадением data-атрибутов:
     data-nav-link="care" ↔ data-nav-section="care". href не
     разбирается, location.hash не читается — значит переезд
     якорей на отдельные страницы не затронет этот код.
     ======================================================= */

  function initScrollSpy() {
    var nav = document.getElementById('primary-nav');
    if (!nav || !('IntersectionObserver' in window)) return;

    var links = {};
    var linkNodes = nav.querySelectorAll('[data-nav-link]');
    for (var i = 0; i < linkNodes.length; i++) {
      links[linkNodes[i].getAttribute('data-nav-link')] = linkNodes[i];
    }

    var sections = [];
    var sectionNodes = document.querySelectorAll('[data-nav-section]');
    for (var j = 0; j < sectionNodes.length; j++) {
      if (links[sectionNodes[j].getAttribute('data-nav-section')]) {
        sections.push(sectionNodes[j]);
      }
    }
    if (!sections.length) return;

    // порядок секций в документе — по нему выбирается верхняя из видимых
    var order = sections.map(function (s) { return s.getAttribute('data-nav-section'); });
    var visible = {};
    var current = null;

    // Единственное место, где активное состояние ставится и снимается
    function setActive(name) {
      if (name === current) return;
      current = name;

      Object.keys(links).forEach(function (key) {
        var link = links[key];
        var isActive = key === name;
        link.classList.toggle('nav__link--active', isActive);
        if (isActive) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var name = entry.target.getAttribute('data-nav-section');
        if (entry.isIntersecting) {
          visible[name] = true;
        } else {
          delete visible[name];
        }
      });

      // строго один активный пункт; если полоса пуста — оставляем прежний
      for (var k = 0; k < order.length; k++) {
        if (visible[order[k]]) {
          setActive(order[k]);
          return;
        }
      }
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (section) { observer.observe(section); });
  }

  /* =======================================================
     4. МОБИЛЬНОЕ МЕНЮ
     Независимо от scrollspy: общего состояния у них нет.
     ======================================================= */

  function initMobileNav() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.getElementById('primary-nav');
    if (!toggle || !nav) return;

    var isOpen = false;

    function setOpen(next, returnFocus) {
      isOpen = next;
      nav.classList.toggle('is-open', next);
      document.body.classList.toggle('nav-open', next);
      toggle.setAttribute('aria-expanded', String(next));
      toggle.setAttribute('aria-label', next ? 'Закрыть меню' : 'Открыть меню');

      if (next) {
        // Панель выезжает из visibility: hidden, а невидимый элемент сфокусировать
        // нельзя. Принудительный пересчёт применяет новое состояние до focus().
        void nav.offsetHeight;
        var first = nav.querySelector('a');
        if (first) first.focus();
      } else if (returnFocus) {
        toggle.focus();
      }
    }

    toggle.addEventListener('click', function () {
      setOpen(!isOpen, true);
    });

    // закрытие по клику на пункт
    nav.addEventListener('click', function (event) {
      if (isOpen && event.target.closest('a')) setOpen(false, true);
    });

    // закрытие по клику вне панели
    document.addEventListener('click', function (event) {
      if (!isOpen) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      setOpen(false, false);
    });

    // закрытие по Escape
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen) setOpen(false, true);
    });

    // при переходе на десктоп панель не должна оставаться «открытой»
    desktopQuery.addEventListener('change', function (event) {
      if (event.matches && isOpen) setOpen(false, false);
    });
  }

  /* =======================================================
     5. АККОРДЕОН В ПОДВАЛЕ
     До 768px колонки свёрнуты, выше — раскрыты и неинтерактивны
     (клики по summary там гасит pointer-events в CSS).
     ======================================================= */

  function initFooterAccordion() {
    var groups = document.querySelectorAll('[data-footer-accordion]');
    if (!groups.length) return;

    function sync() {
      for (var i = 0; i < groups.length; i++) {
        groups[i].open = desktopQuery.matches;
      }
    }

    sync();
    desktopQuery.addEventListener('change', sync);
  }

  /* =======================================================
     6. ПОЯВЛЕНИЕ БЛОКОВ ПРИ СКРОЛЛЕ
     Однократное срабатывание: после показа снимаем наблюдение.
     Внутри [data-stagger] соседние элементы получают задержку.
     ======================================================= */

  function initReveal() {
    var items = document.querySelectorAll('.reveal, [data-reveal]');
    if (!items.length) return;

    function showAll() {
      for (var i = 0; i < items.length; i++) {
        items[i].classList.add('is-visible');
      }
    }

    if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
      showAll();
      return;
    }

    // ступенчатая задержка внутри групп: 70мс на каждый следующий элемент
    var groups = document.querySelectorAll('[data-stagger]');
    for (var g = 0; g < groups.length; g++) {
      var groupItems = groups[g].querySelectorAll('.reveal, [data-reveal]');
      for (var j = 0; j < groupItems.length; j++) {
        groupItems[j].style.setProperty('--reveal-delay', (j * 70) + 'ms');
      }
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.15 });

    for (var k = 0; k < items.length; k++) {
      observer.observe(items[k]);
    }
  }

  /* =======================================================
     7. АККОРДЕОН FAQ
     Нативный <details> раскрывается рывком, поэтому высоту
     анимируем вручную. Без JS и при reduce-motion остаётся
     штатное поведение браузера.
     ======================================================= */

  function initFaq() {
    var items = document.querySelectorAll('.faq__item');

    Array.prototype.forEach.call(items, function (item) {
      var summary = item.querySelector('.faq__question');
      var body = item.querySelector('.faq__body');
      if (!summary || !body) return;

      summary.addEventListener('click', function (event) {
        if (prefersReducedMotion.matches) return;

        if (item.dataset.animating === 'true') {
          event.preventDefault();
          return;
        }

        event.preventDefault();
        item.dataset.animating = 'true';

        var onEnd = function (e) {
          if (e.propertyName !== 'height') return;
          body.style.height = '';
          item.dataset.animating = 'false';
          body.removeEventListener('transitionend', onEnd);
        };

        if (item.open) {
          body.style.height = body.scrollHeight + 'px';
          void body.offsetHeight; // принудительный пересчёт, иначе перехода не будет
          body.style.height = '0px';

          body.addEventListener('transitionend', function collapse(e) {
            if (e.propertyName !== 'height') return;
            item.open = false;
            body.style.height = '';
            item.dataset.animating = 'false';
            body.removeEventListener('transitionend', collapse);
          });
        } else {
          item.open = true;
          var target = body.scrollHeight;
          body.style.height = '0px';
          void body.offsetHeight; // фиксируем нулевую высоту как стартовую точку
          body.style.height = target + 'px';

          body.addEventListener('transitionend', onEnd);
        }
      });
    });
  }

  /* =======================================================
     8. ИНТЕРАКТИВНОЕ ФОТО: «ПОГЛАДЬ МОПСА»

     Пользователь водит курсором или пальцем по собаке, рамка
     разгорается, на пороге запускается видео с прояснением погоды
     и остаётся на последнем кадре. Состояние финальное: повторить
     эффект можно только перезагрузкой.

     Здесь единственное во всём скрипте место, где считаются
     координаты, поэтому вся геометрия держится на двух правилах:
     — координату даёт offsetX/offsetY самого события. Слои поверх
       фото не принимают события (pointer-events: none в CSS), цель
       всегда одна и совпадает с внутренним боксом .pet. Побочный
       выигрыш: прокрутка страницы координаты не сдвигает, а
       getBoundingClientRect не нужен ни разу;
     — размеры зоны кэшируются и пересчитываются только по resize.

     Обработчик движения ничего не вычисляет: он лишь запоминает
     точку и просит кадр. Разбор хода, начисление и запись
     CSS-переменной идут внутри requestAnimationFrame — не чаще
     одного раза за кадр, сколько бы событий ни пришло.
     ======================================================= */

  function initPetInteraction() {
    var pet = document.querySelector('[data-pet]');
    if (!pet) return;

    // Понижённая подвижность: жеста нет, видео не играет, подсказки нет.
    // Остальное доделывает CSS — статичное фото без рамки и свечения.
    if (prefersReducedMotion.matches) return;

    var video = pet.querySelector('[data-pet-video]');
    var hint = pet.querySelector('[data-pet-hint]');
    var playBtn = pet.querySelector('[data-pet-play]');

    /* --- Пороги. Доли — от ширины зоны, не всего фото --- */
    var FULL = 0.7;         // ход от 70% ширины зоны — полный
    var PARTIAL = 0.3;      // от 30% — частичный, ниже очков нет
    var JITTER = 0.05;      // разворот короче 5% — дрожание руки, не смена хода
    var GAIN_FULL = 0.25;   // 4 полных хода (2 поглаживания туда-обратно) = 1.0
    var GAIN_PARTIAL = 0.167;
    var IDLE_MS = 1200;     // столько ждём после последнего движения
    var DECAY_MS = 800;     // и столько гасим прогресс до нуля
    var HINT_MS = 1500;

    /* --- Зона: проценты от размеров блока, кэшируются --- */
    var zone = { x: 0, y: 0, w: 1, h: 1, jitter: 0 };

    function pct(name, fallback) {
      var value = parseFloat(pet.getAttribute(name));
      return isFinite(value) ? value : fallback;
    }

    var pctX = pct('data-zone-x', 0);
    var pctY = pct('data-zone-y', 0);
    var pctW = pct('data-zone-w', 100);
    var pctH = pct('data-zone-h', 100);

    // clientWidth/clientHeight — внутренний бокс, без рамки: ровно та система
    // координат, в которой приходят offsetX/offsetY
    function measure() {
      var w = pet.clientWidth;
      var h = pet.clientHeight;
      zone.x = w * pctX / 100;
      zone.y = h * pctY / 100;
      zone.w = Math.max(1, w * pctW / 100);
      zone.h = Math.max(1, h * pctH / 100);
      zone.jitter = zone.w * JITTER;
    }

    measure();

    var resizeTimer = 0;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(measure, 150);
    }

    /* --- Состояние --- */
    var progress = 0;
    var written = -1;        // последнее записанное значение: лишних записей не делаем
    var lastActivity = 0;    // время последнего движения в зоне, по часам rAF
    var decayFrom = -1;      // прогресс на момент начала затухания

    var dir = 0;             // направление текущего хода: 1 вправо, -1 влево
    var anchor = null;       // начало хода
    var peak = 0;            // самая дальняя точка хода в его направлении

    var pending = null;      // координаты, ждущие кадра
    var rafId = 0;
    var pointerId = null;    // мультитач: ведём только первый палец
    var hintTimer = 0;
    var touched = false;     // был ли хоть один засчитанный ход
    var done = false;        // порог взят или жест отключён — считать больше нечего
    var videoOk = !!video;

    function inZone(x, y) {
      return x >= zone.x && x <= zone.x + zone.w &&
             y >= zone.y && y <= zone.y + zone.h;
    }

    function write() {
      if (progress === written) return;
      written = progress;
      pet.style.setProperty('--pet-progress', progress.toFixed(3));
    }

    /* --- Подсчёт ходов --- */

    // Ход закрыт: начисляем по его длине. Короче JITTER — не ход вовсе,
    // такие отрезки не должны прерывать поглаживание (см. reverse ниже).
    function scoreStroke(length) {
      if (done || length < zone.jitter) return;

      var share = length / zone.w;
      var gain = share >= FULL ? GAIN_FULL : (share >= PARTIAL ? GAIN_PARTIAL : 0);
      if (!gain) return;

      progress = Math.min(1, progress + gain);
      write();

      if (!touched) {
        touched = true;
        clearTimeout(hintTimer);
        if (hint) hint.classList.remove('is-visible');
      }

      if (progress >= 1) finish(false);
    }

    // Ход обрывается: курсор ушёл из зоны или вообще с фото
    function closeStroke() {
      if (dir !== 0) scoreStroke((peak - anchor) * dir);
      dir = 0;
      anchor = null;
    }

    function track(x, y, now) {
      if (!inZone(x, y)) {
        closeStroke();      // вне зоны время не идёт: начнётся затухание
        return;
      }

      lastActivity = now;
      decayFrom = -1;

      if (dir === 0) {
        // первая точка после входа в зону задаёт отсчёт, направления ещё нет
        if (anchor === null) anchor = x;
        if (x === anchor) return;
        dir = x > anchor ? 1 : -1;
        peak = x;
        return;
      }

      if ((x - peak) * dir > 0) {
        peak = x;           // ход продолжается в ту же сторону
        return;
      }

      // Движение назад. Пока оно меньше порога дрожания — это не разворот,
      // иначе тремор руки нарезал бы одно поглаживание на десяток огрызков.
      if ((peak - x) * dir < zone.jitter) return;

      // Разворот: закрываем ход и начинаем новый от точки перелома
      scoreStroke((peak - anchor) * dir);
      if (done) return;
      anchor = peak;
      peak = x;
      dir = -dir;
    }

    /* --- Кадр: разбор движения и затухание --- */

    function frame(now) {
      rafId = 0;

      if (pending) {
        var point = pending;
        pending = null;
        track(point.x, point.y, now);
      }

      if (done) return;

      // 1.2с тишины — и прогресс линейно уходит в ноль за 0.8с
      if (progress > 0) {
        var idle = now - lastActivity;
        if (idle > IDLE_MS) {
          if (decayFrom < 0) decayFrom = progress;
          var passed = (idle - IDLE_MS) / DECAY_MS;
          progress = passed >= 1 ? 0 : decayFrom * (1 - passed);
          write();
        }
      }

      if (progress > 0 || pending) rafId = requestAnimationFrame(frame);
    }

    function requestFrame() {
      if (!rafId) rafId = requestAnimationFrame(frame);
    }

    /* --- События указателя: только накопить координаты --- */

    function onPointerMove(event) {
      if (done) return;
      if (pointerId === null) pointerId = event.pointerId;
      else if (event.pointerId !== pointerId) return;   // второй палец игнорируем

      var x = event.offsetX;
      var y = event.offsetY;

      // Внутри зоны жест ведёт мопса, а не страницу
      if (inZone(x, y) && event.cancelable) event.preventDefault();

      pending = { x: x, y: y };
      requestFrame();
    }

    function onPointerOut() {
      pointerId = null;
      if (done) return;
      // Курсор ушёл с фото: ход обрываем сразу, иначе возвращение
      // в другой точке дало бы фантомный «ход» через всю зону
      closeStroke();
      pending = null;
      if (progress > 0) requestFrame();
    }

    /* --- Финал --- */

    function detach() {
      pet.removeEventListener('pointermove', onPointerMove);
      pet.removeEventListener('pointerleave', onPointerOut);
      pet.removeEventListener('pointercancel', onPointerOut);
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
      clearTimeout(hintTimer);
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      pending = null;
    }

    // Гасим рамку и включаем видео. Фото под ним остаётся на месте.
    function reveal() {
      pet.classList.add('pet--done');
      progress = 0;
      write();

      if (hint) hint.classList.remove('is-visible');
      if (playBtn && playBtn.parentNode) playBtn.parentNode.removeChild(playBtn);
      if (!video || !videoOk) return;

      var promise = video.play();
      // Отказ автозапуска не должен сыпать в консоль: фото само по себе целое
      if (promise && typeof promise.catch === 'function') {
        promise.catch(function () {});
      }
    }

    function finish(instant) {
      if (done) return;
      done = true;
      detach();

      if (instant) {
        reveal();
        return;
      }

      // Даём свечению доехать до максимума (переход 120ms), и только
      // потом гасим его и проявляем видео — иначе вспышка не читается
      progress = 1;
      write();
      setTimeout(reveal, 160);
    }

    /* --- Подсказка --- */

    function initHint() {
      if (!hint || !('IntersectionObserver' in window)) return;

      if (window.matchMedia('(pointer: coarse)').matches) {
        hint.textContent = 'Погладьте мопса пальцем';
      }

      var observer = new IntersectionObserver(function (entries, obs) {
        if (!entries[0].isIntersecting) return;
        obs.unobserve(pet);

        hintTimer = setTimeout(function () {
          if (touched || done) return;
          hint.classList.add('is-visible');
        }, HINT_MS);
      }, { threshold: 0.25 });

      observer.observe(pet);
    }

    /* --- Отказоустойчивость: видео не загрузилось --- */

    if (video) {
      video.addEventListener('error', function () {
        videoOk = false;
        pet.classList.add('pet--no-video');
        clearTimeout(hintTimer);
        if (hint) hint.classList.remove('is-visible');
        if (playBtn && playBtn.parentNode) playBtn.parentNode.removeChild(playBtn);
        if (!done) {
          done = true;
          detach();
        }
      });
    }

    /* --- Подключение --- */

    pet.addEventListener('pointermove', onPointerMove, { passive: false });
    pet.addEventListener('pointerleave', onPointerOut);
    pet.addEventListener('pointercancel', onPointerOut);
    window.addEventListener('resize', onResize);

    if (playBtn) {
      playBtn.addEventListener('click', function () { finish(true); });
    }

    initHint();
  }

  initTheme();
  initHeaderShadow();
  initScrollSpy();
  initMobileNav();
  initFooterAccordion();
  initReveal();
  initFaq();
  initPetInteraction();
})();
