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
        localStorage.setItem('mopsomania:theme', next);
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
     3. АКТИВНЫЙ ПУНКТ МЕНЮ (многостраничный режим)

     Раздел известен заранее — он записан в data-page у <body>, —
     поэтому подсветка ставится один раз при инициализации и больше
     не меняется. Совпадение по-прежнему ищется ТОЛЬКО по data-атрибутам:
     data-nav-link="care" ↔ data-page="care". href не разбирается и
     location.pathname не читается, так что переименование папок
     не затронет ни CSS, ни этот код.

     Ссылки подвала несут те же data-nav-link. Класс им не нужен —
     он оформляет только пункты меню, — но aria-current на ссылке,
     ведущей на текущую страницу, ставится и там.
     ======================================================= */

  function initActiveNav() {
    var page = document.body.getAttribute('data-page');
    if (!page) return;

    var links = document.querySelectorAll('[data-nav-link]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute('data-nav-link') !== page) continue;
      links[i].setAttribute('aria-current', 'page');
      if (links[i].classList.contains('nav__link')) {
        links[i].classList.add('nav__link--active');
      }
    }
  }

  /* =======================================================
     4. SCROLLSPY
     После перехода на отдельные страницы разделов [data-nav-section]
     в разметке больше нет, и функция молча выходит. Оставлена
     намеренно: во втором заходе ею будет подсвечиваться оглавление
     внутри длинных страниц.

     ВНИМАНИЕ: если такие секции появятся, setActive() начнёт
     переключать пункты ГЛАВНОГО меню и передерётся со статической
     подсветкой из initActiveNav(). Под оглавление нужно будет сузить
     область поиска ссылок — не по #primary-nav, а по контейнеру .toc.
     ======================================================= */

  function initScrollSpy() {
    var sectionNodes = document.querySelectorAll('[data-nav-section]');
    if (!sectionNodes.length) return;   // многостраничный режим: секций нет

    var nav = document.getElementById('primary-nav');
    if (!nav || !('IntersectionObserver' in window)) return;

    var links = {};
    var linkNodes = nav.querySelectorAll('[data-nav-link]');
    for (var i = 0; i < linkNodes.length; i++) {
      links[linkNodes[i].getAttribute('data-nav-link')] = linkNodes[i];
    }

    var sections = [];
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
     5. МОБИЛЬНОЕ МЕНЮ
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
     6. АККОРДЕОН В ПОДВАЛЕ
     До 768px колонки свёрнуты, выше — раскрыты и неинтерактивны
     (клики по summary там гасит pointer-events в CSS).
     ======================================================= */

  function initFooterAccordion() {
    var groups = document.querySelectorAll('[data-footer-accordion]');
    if (!groups.length) return;

    // В разметке у <details> стоит open: без скриптов колонки раскрыты и все
    // ссылки видны. Сворачиваем их только на мобильном — на десктопе остаются.
    function sync() {
      for (var i = 0; i < groups.length; i++) {
        groups[i].open = desktopQuery.matches;
      }
    }

    // Выше 769px аккордеона нет, и клик по заголовку не должен сворачивать
    // колонку. Раньше это делал pointer-events: none в CSS, но он же скрывал
    // ссылки от тех, у кого JS не работает, — поэтому запрет переехал сюда,
    // где он действует только при живых скриптах.
    for (var i = 0; i < groups.length; i++) {
      var summary = groups[i].querySelector('.footer__summary');
      if (!summary) continue;
      summary.addEventListener('click', function (event) {
        if (desktopQuery.matches) event.preventDefault();
      });
    }

    sync();
    desktopQuery.addEventListener('change', sync);
  }

  /* =======================================================
     7. ПОЯВЛЕНИЕ БЛОКОВ ПРИ СКРОЛЛЕ
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
     8. АККОРДЕОН FAQ
     Нативный <details> раскрывается рывком, поэтому высоту
     анимируем вручную. Без JS и при reduce-motion остаётся
     штатное поведение браузера.
     ======================================================= */

  function initFaq() {
    var items = document.querySelectorAll('.faq__item');

    /*
      Стартовое состояние: в каждом блоке .faq открыт только первый вопрос.
      В разметке open стоит у всех и остаётся там — без скриптов ответы
      обязаны быть видимы. Закрываем свойством .open, а не removeAttribute:
      результат тот же, но намерение читается.

      Считаем по блокам, а не по странице: если на странице окажется
      второй .faq, у него будет свой первый открытый вопрос.
    */
    if (document.documentElement.classList.contains('js')) {
      var blocks = document.querySelectorAll('.faq');
      Array.prototype.forEach.call(blocks, function (block) {
        var blockItems = block.querySelectorAll('.faq__item');
        for (var i = 1; i < blockItems.length; i++) {
          blockItems[i].open = false;
        }
      });
    }

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
     9. ИНТЕРАКТИВНОЕ ФОТО: «ПОГЛАДЬ МОПСА»

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
    var photo = pet.querySelector('.pet__photo');

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

    /*
      Направление касания. Раньше здесь стоял безусловный touch-action: none,
      и палец на фото не мог пролистать страницу: человек упирался в снимок
      и не понимал, почему сайт «завис». Теперь ось жеста определяется
      по первым AXIS_LOCK пикселям и держится до отпускания пальца:
        горизонталь — это поглаживание, движение гасится preventDefault;
        вертикаль   — это прокрутка, ход не считается и не гасится.
      Пока смещение меньше порога, не делается ничего: направления ещё нет.

      Мыши это не касается вовсе (pointerType === 'mouse'): курсор гладит
      мопса без нажатия, никакого «жеста» с началом и концом у него нет,
      и прокрутке колесом он не мешает.
    */
    var AXIS_LOCK = 10;      // px: столько нужно проехать, чтобы ось определилась
    var gestureId = null;    // касание, начавшееся на фото
    var gestureX = 0;
    var gestureY = 0;
    var axis = '';           // '' — ещё не ясно, 'x' — поглаживание, 'y' — прокрутка
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

    // Касание началось на фото — запоминаем точку отсчёта. Ось пока неизвестна.
    function onPointerDown(event) {
      if (event.pointerType === 'mouse') return;
      gestureId = event.pointerId;
      gestureX = event.clientX;
      gestureY = event.clientY;
      axis = '';
    }

    /*
      Палец отпущен или жест перехвачен браузером под прокрутку.
      Ход обязательно закрывается здесь: очки начисляются в момент
      закрытия, а палец, в отличие от курсора, уходит с фото, не пересекая
      его края, — pointerleave при отрыве не приходит, и последнее
      поглаживание пропадало бы целиком.

      Мыши это не касается: у неё gestureId остаётся null, и обычный
      клик по фото ход не обрывает.
    */
    function onPointerEnd(event) {
      if (gestureId === null || event.pointerId !== gestureId) return;
      gestureId = null;
      axis = '';
      pointerId = null;
      if (done) return;

      // Последняя точка ещё ждёт кадра — без неё ход окажется короче,
      // чем был на самом деле
      if (pending) {
        var point = pending;
        pending = null;
        track(point.x, point.y, performance.now());
      }

      closeStroke();
      if (progress > 0) requestFrame();
    }

    function onPointerMove(event) {
      if (done) return;

      if (event.pointerType !== 'mouse') {
        // Касание, начавшееся не на фото, сюда попасть не должно
        if (gestureId === null || event.pointerId !== gestureId) return;

        if (!axis) {
          var moveX = Math.abs(event.clientX - gestureX);
          var moveY = Math.abs(event.clientY - gestureY);
          // Порог не взят: направления ещё нет, и вмешиваться рано
          if (moveX < AXIS_LOCK && moveY < AXIS_LOCK) return;
          axis = moveX > moveY ? 'x' : 'y';
        }

        // Вертикаль: страница прокручивается как обычно, ход не засчитываем
        if (axis === 'y') return;
      }

      // Инвариант системы координат: offsetX/offsetY отсчитываются от ЦЕЛИ
      // события, а она обязана быть фотографией — её бокс совпадает с внутренним
      // боксом .pet. У слоёв поверх снят pointer-events, но клавиатурная кнопка
      // по :focus-visible разворачивается в полноразмерный бокс и хит-тест
      // перехватывает: без этой проверки координаты пришли бы относительно неё.
      if (photo && event.target !== photo) return;

      if (pointerId === null) pointerId = event.pointerId;
      else if (event.pointerId !== pointerId) return;   // второй палец игнорируем

      var x = event.offsetX;
      var y = event.offsetY;

      // Внутри зоны жест ведёт мопса, а не страницу
      if (inZone(x, y) && event.cancelable) event.preventDefault();

      pending = { x: x, y: y };
      requestFrame();
    }

    // Браузер забрал жест под прокрутку: закрываем ход и сбрасываем ось
    function onPointerCancel(event) {
      onPointerEnd(event);
      onPointerOut();
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
      pet.removeEventListener('pointerdown', onPointerDown);
      pet.removeEventListener('pointermove', onPointerMove);
      pet.removeEventListener('pointerup', onPointerEnd);
      pet.removeEventListener('pointerleave', onPointerOut);
      pet.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
      clearTimeout(hintTimer);
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      pending = null;
    }

    // Кнопку НЕ удаляем: она может быть в фокусе, и её исчезновение выбросило бы
    // фокус на <body> — клавиатурный пользователь потерял бы место на странице.
    // Прячем на месте тем же clip-path, что и до фокуса, предварительно переведя
    // фокус на сам блок (у .pet для этого tabindex="-1").
    function hidePlayBtn() {
      if (!playBtn) return;
      if (document.activeElement === playBtn) pet.focus();
      playBtn.disabled = true;
      playBtn.setAttribute('aria-hidden', 'true');
    }

    // Гасим рамку и включаем видео. Фото под ним остаётся на месте.
    function reveal() {
      pet.classList.add('pet--done');
      progress = 0;
      write();

      if (hint) hint.classList.remove('is-visible');
      hidePlayBtn();
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
        hidePlayBtn();   // та же причина, что и в reveal(): фокус не должен пропасть
        if (!done) {
          done = true;
          detach();
        }
      });
    }

    /* --- Подключение --- */

    pet.addEventListener('pointerdown', onPointerDown);
    pet.addEventListener('pointermove', onPointerMove, { passive: false });
    pet.addEventListener('pointerup', onPointerEnd);
    pet.addEventListener('pointerleave', onPointerOut);
    pet.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('resize', onResize);

    if (playBtn) {
      playBtn.addEventListener('click', function () { finish(true); });
    }

    initHint();
  }

  /* =======================================================
     10. ТЕСТ «ПОДОЙДЁТ ЛИ ВАМ МОПС»

     Живёт только на /choose/, поэтому функция молча выходит,
     если контейнера [data-quiz] на странице нет.

     Три независимые шкалы по 0–100, общий балл — их среднее.
     Оговорка в формуле одна и она важная: провал по любой шкале
     (ниже 30) не даёт общему подняться выше 40. Иначе две хорошие
     оси вытягивали бы вердикт «подойдёт» там, где третья делает
     содержание мопса невозможным — например, при жарком лете
     без кондиционера.

     Отдельно от неё работает стоп-фактор (аллергия): он обнуляет
     свою шкалу целиком, а не усредняется с соседними ответами.

     Результат нигде не сохраняется: тест проходят ради ответа,
     а не ради истории, поэтому localStorage здесь не нужен.

     Разметку строит эта функция целиком. В HTML лежит только
     запасной блок .quiz-fallback — он и виден, когда скриптов нет.
     ======================================================= */

  function initQuiz() {
    var mount = document.querySelector('[data-quiz]');
    if (!mount) return;

    var SCALES = [
      { id: 'life', label: 'Быт и время' },
      { id: 'act', label: 'Активность' },
      { id: 'cond', label: 'Условия' }
    ];

    var QUESTIONS = [
      { scale: 'life', text: 'Где вы живёте?', options: [
        { label: 'Квартира', value: 100 },
        { label: 'Дом с участком', value: 100 },
        { label: 'Комната в общежитии', value: 40 }
      ] },
      { scale: 'life', text: 'Сколько часов в день собака будет одна?', options: [
        { label: 'До 4', value: 100 },
        { label: '4–7', value: 70 },
        { label: '8–10', value: 30 },
        { label: 'Больше 10', value: 0 }
      ] },
      { scale: 'life', text: 'Есть ли в доме дети младше 5 лет?', options: [
        { label: 'Нет', value: 100 },
        { label: 'Да, но под присмотром', value: 60 },
        { label: 'Да, часто без присмотра', value: 30 }
      ] },
      { scale: 'act', text: 'Как вы обычно проводите выходные?', options: [
        { label: 'Дома или неспешные прогулки', value: 100 },
        { label: 'Прогулки в парке', value: 100 },
        { label: 'Долгие походы', value: 30 },
        { label: 'Спорт, бег, велосипед', value: 10 }
      ] },
      { scale: 'act', text: 'Чего вы ждёте от собаки на прогулке?', options: [
        { label: 'Спокойно ходить рядом', value: 100 },
        { label: 'Немного играть', value: 80 },
        { label: 'Бегать со мной', value: 10 }
      ] },
      { scale: 'act', text: 'Планируете ли брать собаку в путешествия?', options: [
        { label: 'Нет', value: 100 },
        { label: 'Изредка на машине', value: 80 },
        { label: 'Часто, в том числе самолётом', value: 20,
          hint: 'Многие авиакомпании не перевозят брахицефалов.' }
      ] },
      { scale: 'cond', text: 'Какое лето в вашем регионе?', options: [
        { label: 'Прохладное, до +25', value: 100 },
        { label: 'Тёплое, бывает жарко, есть кондиционер', value: 70 },
        { label: 'Жаркое, выше +30, без кондиционера', value: 0 }
      ] },
      { scale: 'cond', multi: true, text: 'Что из этого про вас?',
        note: 'Можно выбрать несколько вариантов.', options: [
        { label: 'Аллергия на шерсть', value: 0, stop: true },
        { label: 'Мешает храп по ночам', value: 40 },
        { label: 'Раздражает шерсть на одежде', value: 60 },
        { label: 'Ничего из перечисленного', value: 100 }
      ] }
    ];

    /* Порядок важен: берётся первый вердикт, чей порог не выше балла */
    var VERDICTS = [
      { min: 80, title: 'Мопс вам подойдёт',
        text: 'Условия сходятся. Порода спокойная и домашняя — это как раз то, что вы описали.' },
      { min: 60, title: 'Скорее подойдёт',
        text: 'В целом сходится, но есть моменты, которые стоит обдумать заранее.' },
      { min: 40, title: 'Подумайте ещё',
        text: 'Часть условий против. Мопс — не та порода, которая подстраивается под интенсивный режим.' },
      { min: 0, title: 'Скорее не подойдёт',
        text: 'Слишком многое расходится. Это не значит, что собака вам не нужна — но, возможно, стоит посмотреть на другие породы.' }
    ];

    var CHECK_PATH = 'M5 12.5l4.5 4.5L19 7.5';
    var BACK_PATH = 'M19 12H6M11 6l-6 6 6 6';

    /*
      Иконка в кружке варианта. Лапа — значение по умолчанию, остальные
      подобраны по смыслу вопроса: индекс в QUESTION_ICONS совпадает
      с индексом вопроса. Порядок вопросов задан выше и не меняется
      в рантайме, поэтому привязка по индексу здесь безопасна.
    */
    var PAW_PATH = 'M12 14c-2.2 0-4 1.6-4 3.5S9.8 21 12 21s4-1.6 4-3.5S14.2 14 12 14z' +
                   'M7 11.5a1.6 2 0 1 0 0-.1zM17 11.5a1.6 2 0 1 0 0-.1z' +
                   'M9.7 6.5a1.5 2 0 1 0 0-.1zM14.3 6.5a1.5 2 0 1 0 0-.1z';
    var HOME_PATH = 'M4 11l8-6.5 8 6.5M6.5 9.7V19h11V9.7M10.5 19v-4.5h3V19';
    var CLOCK_PATH = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2';
    var USERS_PATH = 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5' +
                     'M16 6.2a3 3 0 0 1 0 5.6M17 14.2c2 .6 3.5 2.4 3.5 4.8';
    var SUN_PATH = 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5V4M12 20v1.5' +
                   'M4.2 4.2l1.1 1.1M18.7 18.7l1.1 1.1M2.5 12H4M20 12h1.5' +
                   'M4.2 19.8l1.1-1.1M18.7 5.3l1.1-1.1';
    var BAG_PATH = 'M4.5 8h15v11.5h-15zM9 8V5.5h6V8M4.5 13h15';

    var QUESTION_ICONS = [
      HOME_PATH,   // где вы живёте
      CLOCK_PATH,  // сколько часов собака одна
      USERS_PATH,  // дети младше 5
      PAW_PATH,    // выходные
      PAW_PATH,    // чего ждёте на прогулке
      BAG_PATH,    // путешествия
      SUN_PATH,    // какое лето
      PAW_PATH     // что из этого про вас
    ];

    var answers = [];      // индекс варианта, у множественного — массив индексов
    var current = 0;
    var submitBtn = null;  // кнопка «Показать результат», только у вопроса 8

    function icon(cls, path) {
      return '<svg class="icon ' + cls + '" viewBox="0 0 24 24" aria-hidden="true" ' +
             'focusable="false"><path d="' + path + '"/></svg>';
    }

    /* --- Подсчёт --- */

    function scaleScore(scaleId) {
      var values = [];
      var stopped = false;

      QUESTIONS.forEach(function (q, i) {
        if (q.scale !== scaleId) return;
        var answer = answers[i];
        if (answer === undefined) return;

        var picked = q.multi
          ? answer.map(function (index) { return q.options[index]; })
          : [q.options[answer]];

        picked.forEach(function (opt) { if (opt.stop) stopped = true; });

        // У множественного выбора берётся минимум: ограничение весит
        // больше, чем всё мягкое, отмеченное рядом с ним
        values.push(Math.min.apply(null, picked.map(function (opt) {
          return opt.value;
        })));
      });

      if (stopped) return 0;
      if (!values.length) return 0;

      var sum = values.reduce(function (acc, v) { return acc + v; }, 0);
      return Math.round(sum / values.length);
    }

    function totalScore(scores) {
      var sum = scores.reduce(function (acc, v) { return acc + v; }, 0);
      var total = Math.round(sum / scores.length);
      var lowest = Math.min.apply(null, scores);

      // Провал по критичной оси не должен давать вердикт «подойдёт»
      if (lowest < 30 && total > 40) total = 40;
      return total;
    }

    /* --- Оболочка. Строится один раз: aria-live объявляет смену вопроса
           только у элемента, который остаётся в DOM между перерисовками.
           Пересоздавать его вместе с вопросом нельзя — объявления не будет. --- */

    var box = document.createElement('div');
    box.className = 'quiz';

    var head = document.createElement('div');
    head.className = 'quiz__head';

    /* Текст «Вопрос N из 8» спрятан визуально, но остаётся в DOM:
       это он объявляет смену вопроса. Видимый индикатор — сегменты ниже. */
    var progress = document.createElement('p');
    progress.className = 'quiz__progress';
    progress.setAttribute('aria-live', 'polite');

    var steps = document.createElement('div');
    steps.className = 'quiz__steps';
    steps.setAttribute('aria-hidden', 'true');

    var stepEls = QUESTIONS.map(function () {
      var s = document.createElement('span');
      s.className = 'quiz__step';
      steps.appendChild(s);
      return s;
    });

    var back = document.createElement('button');
    back.className = 'quiz__back';
    back.type = 'button';
    back.innerHTML = icon('quiz__back-icon', BACK_PATH) + 'Назад';
    back.addEventListener('click', function () {
      if (current === 0) return;
      current--;
      renderQuestion(true);
    });

    head.appendChild(progress);
    head.appendChild(steps);
    head.appendChild(back);

    var body = document.createElement('div');
    body.className = 'quiz__body';

    box.appendChild(head);
    box.appendChild(body);
    mount.appendChild(box);

    /* --- Отрисовка --- */

    function toggleOption(index, btn) {
      var picked = answers[current] || [];
      var at = picked.indexOf(index);

      if (at === -1) picked.push(index);
      else picked.splice(at, 1);

      answers[current] = picked;
      btn.setAttribute('aria-pressed', at === -1 ? 'true' : 'false');
      if (submitBtn) submitBtn.disabled = picked.length === 0;
    }

    function advance() {
      if (current < QUESTIONS.length - 1) {
        current++;
        renderQuestion(true);
      } else {
        renderResult();
      }
    }

    /*
      moveFocus переводит фокус на контейнер вопроса — так смена вопроса
      доходит до скринридера, а клавиатурный фокус не улетает на <body>
      вместе с удалённой кнопкой. На самой первой отрисовке фокус
      не забираем: страница только что загрузилась, и утаскивать его
      в середину документа нельзя.
    */
    function renderQuestion(moveFocus) {
      var q = QUESTIONS[current];

      head.hidden = false;
      back.hidden = (current === 0);
      progress.textContent = 'Вопрос ' + (current + 1) + ' из ' + QUESTIONS.length;

      stepEls.forEach(function (s, i) {
        s.className = 'quiz__step' + (i <= current ? ' quiz__step--done' : '');
      });

      body.innerHTML = '';
      submitBtn = null;

      var wrap = document.createElement('div');
      wrap.className = 'quiz__question';
      wrap.tabIndex = -1;

      var title = document.createElement('h3');
      title.className = 'quiz__title';
      title.textContent = q.text;
      wrap.appendChild(title);

      if (q.note) {
        var note = document.createElement('p');
        note.className = 'quiz__note';
        note.textContent = q.note;
        wrap.appendChild(note);
      }

      var list = document.createElement('div');
      list.className = 'quiz__options';
      var chosen = answers[current];

      q.options.forEach(function (opt, index) {
        var btn = document.createElement('button');
        btn.className = 'quiz__option';
        btn.type = 'button';

        /*
          aria-pressed и у одиночного выбора: строго это состояние
          переключателя, но переход к следующему вопросу мгновенный,
          и единственный момент, когда состояние видно, — возврат
          по «Назад». Радиогруппа с role="radio" потребовала бы
          навигации стрелками, а варианты должны оставаться
          обычными кнопками, доступными по Tab.
        */
        var pressed = q.multi
          ? (chosen || []).indexOf(index) !== -1
          : chosen === index;
        btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');

        btn.insertAdjacentHTML('beforeend',
          '<span class="quiz__option-icon">' +
            icon('', QUESTION_ICONS[current] || PAW_PATH) +
          '</span>');

        var label = document.createElement('span');
        label.className = 'quiz__option-label';
        label.textContent = opt.label;

        if (opt.hint) {
          var hint = document.createElement('span');
          hint.className = 'quiz__option-hint';
          hint.textContent = opt.hint;
          label.appendChild(hint);
        }

        btn.appendChild(label);
        btn.insertAdjacentHTML('beforeend', icon('quiz__option-check', CHECK_PATH));

        btn.addEventListener('click', function () {
          if (q.multi) {
            toggleOption(index, btn);
          } else {
            answers[current] = index;
            advance();
          }
        });

        list.appendChild(btn);
      });

      wrap.appendChild(list);

      // У множественного выбора переход по кнопке: иначе первый же
      // отмеченный вариант уносил бы на результат
      if (q.multi) {
        submitBtn = document.createElement('button');
        submitBtn.className = 'btn btn--primary quiz__submit';
        submitBtn.type = 'button';
        submitBtn.textContent = 'Показать результат';
        submitBtn.disabled = !(chosen && chosen.length);
        submitBtn.addEventListener('click', advance);
        wrap.appendChild(submitBtn);
      }

      body.appendChild(wrap);
      if (moveFocus) wrap.focus({ preventScroll: true });
    }

    function scaleRow(label, value) {
      var row = document.createElement('div');
      row.className = 'quiz__scale';
      // Значение продублировано текстом рядом с полосой, поэтому сама
      // полоса от скринридера скрыта — иначе он прочитает его дважды
      row.innerHTML =
        '<div class="quiz__scale-head">' +
          '<span class="quiz__scale-label">' + label + '</span>' +
          '<span class="quiz__scale-value">' + value + '/100</span>' +
        '</div>' +
        '<div class="quiz__bar" aria-hidden="true"><span class="quiz__fill"></span></div>';
      return row;
    }

    function renderResult() {
      var scores = SCALES.map(function (s) { return scaleScore(s.id); });
      var total = totalScore(scores);
      var verdict = VERDICTS.filter(function (v) { return total >= v.min; })[0];

      head.hidden = true;
      body.innerHTML = '';

      var wrap = document.createElement('div');
      wrap.className = 'quiz__result';
      wrap.tabIndex = -1;

      var fills = [];

      var scalesBox = document.createElement('div');
      scalesBox.className = 'quiz__scales';
      SCALES.forEach(function (s, i) {
        var row = scaleRow(s.label, scores[i]);
        scalesBox.appendChild(row);
        fills.push({ el: row.querySelector('.quiz__fill'), value: scores[i] });
      });
      wrap.appendChild(scalesBox);

      var totalBox = document.createElement('div');
      totalBox.className = 'quiz__total';
      totalBox.innerHTML =
        '<div class="quiz__total-head">' +
          '<span class="quiz__total-label">Общий балл</span>' +
          '<span class="quiz__total-value">' + total +
            '<span class="quiz__total-max">/100</span></span>' +
        '</div>' +
        '<div class="quiz__bar quiz__bar--total" aria-hidden="true">' +
          '<span class="quiz__fill"></span></div>';
      wrap.appendChild(totalBox);
      fills.push({ el: totalBox.querySelector('.quiz__fill'), value: total });

      var verdictTitle = document.createElement('h3');
      verdictTitle.className = 'quiz__verdict-title';
      verdictTitle.textContent = verdict.title;
      wrap.appendChild(verdictTitle);

      var verdictText = document.createElement('p');
      verdictText.className = 'quiz__verdict';
      verdictText.textContent = verdict.text;
      wrap.appendChild(verdictText);

      var link = document.createElement('p');
      link.innerHTML = '<a class="link" href="#fit">Какие условия нужны мопсу</a>';
      wrap.appendChild(link);

      var again = document.createElement('button');
      again.className = 'btn btn--secondary quiz__restart';
      again.type = 'button';
      again.textContent = 'Пройти заново';
      again.addEventListener('click', function () {
        answers = [];
        current = 0;
        renderQuestion(true);
      });
      wrap.appendChild(again);

      body.appendChild(wrap);
      wrap.focus({ preventScroll: true });

      /*
        Принудительный пересчёт перед установкой ширины: без него браузер
        схлопнет нулевую стартовую ширину и целевую в один проход,
        и заполнение не поедет. Та же ловушка, что в аккордеоне FAQ.
      */
      void wrap.offsetHeight;
      fills.forEach(function (f) { f.el.style.width = f.value + '%'; });
    }

    renderQuestion(false);
  }

  /* =======================================================
     11. ФОРМА ЗАЯВКИ
     Имя и телефон уходят POST-запросом в веб-приложение
     Google Apps Script — другого бэкенда у сайта нет.
     Функция независима от остальных и молча выходит там,
     где формы нет (то есть на всех страницах, кроме главной).
     ======================================================= */

  function initLeadForm() {
    var form = document.querySelector('[data-lead-form]');
    if (!form) return;

    /*
      Веб-приложение Apps Script. Развёрнуто с доступом «Все» — иначе
      Google отвечает редиректом на страницу входа, и заявка теряется.
      При каждом новом деплое адрес меняется: правится здесь, в одном месте.
    */
    var ENDPOINT = 'https://script.google.com/macros/s/AKfycbxoOPbx7sUIQHWFvJXc8SVQXArUXkAwArbg33cQZ_C1G1obp2zCxrnZiT9-8SZ8k-Y/exec';

    var nameInput = document.getElementById('lead-name');
    var phoneInput = document.getElementById('lead-phone');
    var trap = form.querySelector('[name="website"]');
    var submitBtn = form.querySelector('[data-lead-submit]');
    var status = document.querySelector('[data-lead-status]');
    var SUBMIT_LABEL = submitBtn.textContent;

    function checkName(value) {
      var trimmed = value.trim();
      if (!trimmed) return 'Укажите, как вас зовут.';
      if (trimmed.length < 2) return 'Имя слишком короткое — минимум две буквы.';
      return '';
    }

    function checkPhone(value) {
      var digits = value.replace(/\D/g, '');
      if (!digits) return 'Укажите номер телефона.';
      if (digits.length < 10) return 'В номере должно быть не меньше 10 цифр.';
      return '';
    }

    var FIELDS = [
      { input: nameInput, error: document.getElementById('lead-name-error'), check: checkName },
      { input: phoneInput, error: document.getElementById('lead-phone-error'), check: checkPhone }
    ];

    function setError(field, message) {
      field.error.textContent = message;
      if (message) field.input.setAttribute('aria-invalid', 'true');
      else field.input.removeAttribute('aria-invalid');
    }

    FIELDS.forEach(function (field) {
      // Ошибка снимается, как только поле стало правильным. Проверять на
      // каждой букве с нуля нельзя: подсказка мигала бы уже на первом
      // символе, ещё до того, как человек закончил вводить.
      field.input.addEventListener('input', function () {
        if (field.error.textContent && !field.check(field.input.value)) setError(field, '');
      });
    });

    /*
      Маска мягкая: из введённого вычёркиваются только заведомо лишние
      символы, формат номера не навязывается. Поэтому вставка из буфера
      переживает обработку целиком, в каком бы виде номер ни был записан
      («+7 (999) 123-45-67», «8-999-1234567»). Плюс имеет смысл только
      первым символом — остальные убираем.
    */
    phoneInput.addEventListener('input', function () {
      var before = phoneInput.value;
      var cleaned = before.replace(/[^\d+()\s-]/g, '');
      cleaned = cleaned.slice(0, 1) + cleaned.slice(1).replace(/\+/g, '');
      if (cleaned === before) return;

      // Запись value уводит курсор в конец — возвращаем его на место
      // со сдвигом на число вычеркнутых символов
      var caret = phoneInput.selectionStart - (before.length - cleaned.length);
      phoneInput.value = cleaned;
      try {
        phoneInput.setSelectionRange(caret, caret);
      } catch (e) {
        /* У некоторых мобильных клавиатур selection в type="tel" недоступен */
      }
    });

    function clearStatus() {
      status.textContent = '';
      status.className = 'lead__status';
    }

    /*
      Текст ответа приходит разметкой: в сообщении об ошибке есть ссылка
      на почту. Запись через innerHTML в живую область объявляет сообщение
      сама — отдельного «пните aria-live» не нужно.
    */
    function showStatus(kind, html) {
      var path = kind === 'error'
        ? '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16v.5"/>'
        : '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.6 2.6L16 9.5"/>';

      status.className = 'lead__status' + (kind === 'error' ? ' lead__status--error' : '');
      status.innerHTML =
        '<svg class="icon lead__status-icon" viewBox="0 0 24 24" aria-hidden="true" ' +
        'focusable="false">' + path + '</svg>' +
        '<p class="lead__status-text">' + html + '</p>';
    }

    function submitLead(name, phone) {
      return fetch(ENDPOINT, {
        method: 'POST',
        /* text/plain намеренно: с application/json браузер сначала шлёт
           preflight OPTIONS, а веб-приложение Apps Script его не обрабатывает,
           и запрос падает ещё до того, как данные уйдут */
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ name: name, phone: phone })
      }).then(function (res) {
        return res.ok;
      });
    }

    var sending = false;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (sending) return;

      // Ловушка сработала: ведём себя как обычно, но никуда не идём —
      // бот не должен понять, что его отсеяли
      if (trap && trap.value) return;

      var firstInvalid = null;
      FIELDS.forEach(function (field) {
        var message = field.check(field.input.value);
        setError(field, message);
        if (message && !firstInvalid) firstInvalid = field.input;
      });

      if (firstInvalid) {
        // Прошлое сообщение об отправке к текущему состоянию уже не относится
        clearStatus();
        firstInvalid.focus();
        return;
      }

      sending = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправляем…';
      clearStatus();

      submitLead(nameInput.value.trim(), phoneInput.value.trim())
        .then(function (ok) {
          // Ответ не 2xx — дальше по той же ветке, что и обрыв сети
          if (!ok) throw new Error('lead: ответ не ok');

          form.hidden = true;
          form.reset();
          FIELDS.forEach(function (field) { setError(field, ''); });
          showStatus('ok', 'Заявка отправлена, скоро с вами свяжутся.');

          // Форма ушла вместе с кнопкой, на которой был фокус: без этого
          // он падает на <body> и клавиатура теряет место на странице
          status.focus({ preventScroll: true });
        })
        .catch(function () {
          // Поля остаются заполненными: набирать всё заново человек не должен
          showStatus('error', 'Не получилось отправить, попробуйте ещё раз или напишите на ' +
            '<a class="link" href="mailto:hello@mopsomania.ru">hello@mopsomania.ru</a>.');
        })
        .then(function () {
          // Вместо finally: он есть не везде, где есть fetch
          sending = false;
          submitBtn.disabled = false;
          submitBtn.textContent = SUBMIT_LABEL;

          /*
            Выключенная кнопка теряет фокус, и он падает на <body>: включение
            обратно его не возвращает. Возвращаем сами — иначе после ошибки
            клавиатурный обход начинается с начала страницы. Проверка на
            <body> обязательна: в удачной ветке фокус уже уведён на сообщение,
            да и человек мог уйти в другое поле, пока запрос был в пути.
          */
          if (document.activeElement === document.body) {
            submitBtn.focus({ preventScroll: true });
          }
        });
    });
  }

  /* =======================================================
     12. ЛАЙТБОКС

     Снимки в .gallery и .figure открываются крупным планом.
     Разметка диалога и кнопки-обёртки строятся здесь, а не лежат
     в шести файлах: без скриптов лайтбокса нет вовсе, и снимки
     остаются обычными картинками — кликать по ним никто не зовёт.

     Взят нативный <dialog>: он даёт верхний слой поверх липкой шапки,
     удержание фокуса внутри и закрытие по Escape без единой строки
     кода. Возврат фокуса на снимок браузер тоже умеет, но здесь он
     сделан руками — состояние важное, и полагаться на него вслепую
     не хочется.
     ======================================================= */

  function initLightbox() {
    var images = document.querySelectorAll('.gallery__item img, .figure img');
    if (!images.length) return;

    var dialog = document.createElement('dialog');

    // Диалог без showModal бесполезен: обычный show() не держит фокус
    // и не даёт верхнего слоя. Тогда лучше не навешивать вообще ничего,
    // чем сделать снимки кликабельными впустую.
    if (typeof dialog.showModal !== 'function') return;

    dialog.className = 'lightbox';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Фотография крупным планом');
    dialog.innerHTML =
      '<button class="lightbox__close" type="button" aria-label="Закрыть фотографию">' +
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
          '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" ' +
          'stroke-width="2" stroke-linecap="round"/>' +
        '</svg>' +
      '</button>' +
      '<figure class="lightbox__figure">' +
        '<img class="lightbox__img" alt="">' +
        '<figcaption class="lightbox__caption"></figcaption>' +
      '</figure>';
    document.body.appendChild(dialog);

    var closeBtn = dialog.querySelector('.lightbox__close');
    var bigImg = dialog.querySelector('.lightbox__img');
    var caption = dialog.querySelector('.lightbox__caption');
    var lastTrigger = null;

    function open(img, trigger) {
      lastTrigger = trigger;

      // currentSrc, а не src: браузер уже выбрал источник, и лайтбокс
      // показывает ровно тот файл, что лежит на странице
      bigImg.src = img.currentSrc || img.src;
      bigImg.alt = img.alt;

      var fig = img.closest('figure');
      var own = fig ? fig.querySelector('figcaption') : null;
      var text = own ? own.textContent.trim() : '';

      // Подписи у снимка может не быть (галерея) — тогда под фото
      // встаёт alt. Для скринридера это дубль: alt он уже прочитал
      // на самом изображении, поэтому такую подпись прячем от него.
      caption.textContent = text || img.alt;
      if (text) caption.removeAttribute('aria-hidden');
      else caption.setAttribute('aria-hidden', 'true');

      dialog.showModal();
      document.body.classList.add('lightbox-open');
      closeBtn.focus();
    }

    closeBtn.addEventListener('click', function () {
      dialog.close();
    });

    // Клик мимо снимка. Цель именно сам диалог: по фотографии и подписи
    // события приходят от них, и закрытия не будет.
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });

    // Одно место на все три способа закрытия: кнопка, клик мимо и Escape,
    // который <dialog> обрабатывает сам
    dialog.addEventListener('close', function () {
      document.body.classList.remove('lightbox-open');
      if (lastTrigger) lastTrigger.focus();
      lastTrigger = null;
    });

    Array.prototype.forEach.call(images, function (img) {
      /*
        Снимок заворачивается в настоящую кнопку, а не получает
        tabindex с role: так бесплатно приходят Enter, пробел и
        правильная роль. Имя кнопке даёт alt изображения внутри,
        aria-haspopup предупреждает, что откроется диалог.
      */
      var trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'lightbox-trigger';
      trigger.setAttribute('aria-haspopup', 'dialog');

      img.parentNode.insertBefore(trigger, img);
      trigger.appendChild(img);

      trigger.addEventListener('click', function () {
        open(img, trigger);
      });
    });
  }

  initTheme();
  initHeaderShadow();
  initActiveNav();
  initScrollSpy();
  initMobileNav();
  initFooterAccordion();
  initReveal();
  initFaq();
  initPetInteraction();
  initQuiz();
  initLeadForm();
  initLightbox();
})();
