/* ==========================================================================
   Shafran — интерактив сайта
   Ванильный JavaScript, без внешних зависимостей.
   ========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
     Утилиты
     --------------------------------------------------------------------- */

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /** Удерживает фокус внутри контейнера, пока открыт диалог. */
  function trapFocus(container, event) {
    var items = $$(FOCUSABLE, container).filter(function (el) {
      return el.offsetParent !== null;
    });
    if (!items.length) return;

    var first = items[0];
    var last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Блокировка прокрутки страницы без «прыжка» из-за скроллбара. */
  var scrollLock = (function () {
    var count = 0;
    return {
      on: function () {
        if (count === 0) {
          var gap = window.innerWidth - document.documentElement.clientWidth;
          document.body.style.paddingRight = gap > 0 ? gap + 'px' : '';
          document.body.classList.add('is-locked');
        }
        count += 1;
      },
      off: function () {
        count = Math.max(0, count - 1);
        if (count === 0) {
          document.body.classList.remove('is-locked');
          document.body.style.paddingRight = '';
        }
      }
    };
  })();

  /* ---------------------------------------------------------------------
     Хедер: фон при прокрутке
     --------------------------------------------------------------------- */

  var header = $('#header');

  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 40);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------------------
     Мобильная навигация
     --------------------------------------------------------------------- */

  var burger = $('#burger');
  var nav = $('#nav');

  function closeNav() {
    if (!nav.classList.contains('is-open')) return;
    nav.classList.remove('is-open');
    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Открыть меню');
    scrollLock.off();
  }

  function openNav() {
    nav.classList.add('is-open');
    burger.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Закрыть меню');
    scrollLock.on();
  }

  burger.addEventListener('click', function () {
    if (nav.classList.contains('is-open')) closeNav();
    else openNav();
  });

  $$('.nav__link, .nav__phone, .nav__cta', nav).forEach(function (link) {
    link.addEventListener('click', closeNav);
  });

  document.addEventListener('click', function (event) {
    if (!nav.classList.contains('is-open')) return;
    if (nav.contains(event.target) || burger.contains(event.target)) return;
    closeNav();
  });

  // Возврат к десктопной раскладке снимает блокировку прокрутки
  window.addEventListener('resize', function () {
    if (window.innerWidth > 900) closeNav();
  });

  /* ---------------------------------------------------------------------
     Подсветка активного раздела в навигации
     --------------------------------------------------------------------- */

  var navLinks = $$('.nav__link');
  var sections = navLinks
    .map(function (link) { return $(link.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        navLinks.forEach(function (link) {
          link.classList.toggle('is-current', link.getAttribute('href') === '#' + id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (section) { sectionObserver.observe(section); });
  }

  /* ---------------------------------------------------------------------
     Плавное появление блоков при прокрутке
     --------------------------------------------------------------------- */

  var revealItems = $$('.reveal');

  $$('.gallery__item').forEach(function (item, index) {
    item.style.setProperty('--i', index);
  });

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    revealItems.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------------------------------------------------------------------
     Меню: переключение категорий
     --------------------------------------------------------------------- */

  var tabs = $$('.tab');

  function activateTab(tab, setFocus) {
    tabs.forEach(function (item) {
      var isActive = item === tab;
      var panel = document.getElementById(item.getAttribute('aria-controls'));

      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-selected', String(isActive));
      item.tabIndex = isActive ? 0 : -1;

      if (panel) {
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;
      }
    });

    if (setFocus) tab.focus();
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () { activateTab(tab, false); });

    tab.addEventListener('keydown', function (event) {
      var step = 0;
      if (event.key === 'ArrowRight') step = 1;
      else if (event.key === 'ArrowLeft') step = -1;
      else if (event.key === 'Home') return activateTab(tabs[0], true);
      else if (event.key === 'End') return activateTab(tabs[tabs.length - 1], true);
      else return;

      event.preventDefault();
      activateTab(tabs[(index + step + tabs.length) % tabs.length], true);
    });
  });

  /* ---------------------------------------------------------------------
     Универсальный диалог: полное меню и лайтбокс
     --------------------------------------------------------------------- */

  var lastFocused = null;

  function openDialog(root) {
    lastFocused = document.activeElement;
    root.hidden = false;
    scrollLock.on();

    var firstFocusable = $(FOCUSABLE, root);
    if (firstFocusable) firstFocusable.focus();

    root.addEventListener('keydown', onDialogKeydown);
  }

  function closeDialog(root) {
    root.hidden = true;
    scrollLock.off();
    root.removeEventListener('keydown', onDialogKeydown);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function onDialogKeydown(event) {
    var root = event.currentTarget;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog(root);
    } else if (event.key === 'Tab') {
      trapFocus(root, event);
    }
  }

  function bindClosers(root) {
    $$('[data-close]', root).forEach(function (el) {
      el.addEventListener('click', function () { closeDialog(root); });
    });
  }

  /* Полное меню */
  var fullMenu = $('#fullMenu');
  var fullMenuBtn = $('#fullMenuBtn');

  fullMenuBtn.addEventListener('click', function () { openDialog(fullMenu); });
  bindClosers(fullMenu);

  /* ---------------------------------------------------------------------
     Галерея: лайтбокс
     --------------------------------------------------------------------- */

  var lightbox = $('#lightbox');
  var lbImage = $('#lbImage');
  var lbCaption = $('#lbCaption');
  var lbCounter = $('#lbCounter');
  var galleryButtons = $$('.gallery__btn');
  var currentIndex = 0;

  function showSlide(index) {
    currentIndex = (index + galleryButtons.length) % galleryButtons.length;

    var button = galleryButtons[currentIndex];
    var thumb = $('img', button);

    lbImage.src = button.dataset.full;
    lbImage.alt = thumb ? thumb.alt : '';
    lbCaption.textContent = button.dataset.caption || '';
    lbCounter.textContent = (currentIndex + 1) + ' / ' + galleryButtons.length;
  }

  galleryButtons.forEach(function (button, index) {
    button.addEventListener('click', function () {
      showSlide(index);
      openDialog(lightbox);
    });
  });

  bindClosers(lightbox);
  $('#lbPrev').addEventListener('click', function () { showSlide(currentIndex - 1); });
  $('#lbNext').addEventListener('click', function () { showSlide(currentIndex + 1); });

  lightbox.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowLeft') showSlide(currentIndex - 1);
    if (event.key === 'ArrowRight') showSlide(currentIndex + 1);
  });

  // Свайп по фотографии на сенсорных экранах
  var touchStartX = null;

  lightbox.addEventListener('touchstart', function (event) {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });

  lightbox.addEventListener('touchend', function (event) {
    if (touchStartX === null) return;
    var delta = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 48) showSlide(currentIndex + (delta < 0 ? 1 : -1));
    touchStartX = null;
  }, { passive: true });

  /* ---------------------------------------------------------------------
     Форма бронирования
     --------------------------------------------------------------------- */

  var form = $('#bookingForm');
  var success = $('#formSuccess');
  var successText = $('#successText');
  var dateInput = $('#date');
  var timeSelect = $('#time');
  var phoneInput = $('#phone');

  var OPEN_HOUR = 10;
  var LAST_SLOT_MINUTES = 21 * 60 + 30; // последняя бронь — 21:30

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function toISODate(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  /** Заполняет список времени с шагом 30 минут; для сегодня скрывает прошедшее. */
  function fillTimeOptions() {
    var now = new Date();
    var isToday = dateInput.value === toISODate(now);
    var earliest = OPEN_HOUR * 60;

    if (isToday) {
      // ближайший слот — минимум через час от текущего момента
      var soonest = now.getHours() * 60 + now.getMinutes() + 60;
      earliest = Math.max(earliest, Math.ceil(soonest / 30) * 30);
    }

    var previous = timeSelect.value;
    timeSelect.innerHTML = '';

    var placeholder = new Option('Выберите время', '');
    placeholder.disabled = true;
    placeholder.selected = true;
    timeSelect.add(placeholder);

    for (var minutes = earliest; minutes <= LAST_SLOT_MINUTES; minutes += 30) {
      var label = pad(Math.floor(minutes / 60)) + ':' + pad(minutes % 60);
      timeSelect.add(new Option(label, label));
    }

    if (timeSelect.options.length === 1) {
      var closed = new Option('На сегодня запись закрыта', '');
      closed.disabled = true;
      timeSelect.add(closed);
    }

    if (previous) {
      timeSelect.value = previous;
      if (!timeSelect.value) timeSelect.selectedIndex = 0;
    }
  }

  /** Ближайшая дата, на которую ещё можно забронировать: сегодня или завтра. */
  function nearestAvailableDate() {
    var now = new Date();
    var soonest = Math.ceil((now.getHours() * 60 + now.getMinutes() + 60) / 30) * 30;
    var date = new Date();

    if (Math.max(OPEN_HOUR * 60, soonest) > LAST_SLOT_MINUTES) date.setDate(date.getDate() + 1);
    return toISODate(date);
  }

  // Бронировать можно с сегодняшнего дня и на 90 дней вперёд
  var maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 90);

  dateInput.min = toISODate(new Date());
  dateInput.max = toISODate(maxDate);
  dateInput.value = nearestAvailableDate();
  fillTimeOptions();

  dateInput.addEventListener('change', fillTimeOptions);

  /** Маска телефона в формате +7 (999) 999-99-99. */
  function formatPhone(value) {
    var digits = value.replace(/\D/g, '');

    if (digits.startsWith('8')) digits = '7' + digits.slice(1);
    if (!digits.startsWith('7')) digits = '7' + digits;
    digits = digits.slice(0, 11);

    var rest = digits.slice(1);
    var out = '+7';

    if (rest.length) out += ' (' + rest.slice(0, 3);
    if (rest.length >= 3) out += ')';
    if (rest.length > 3) out += ' ' + rest.slice(3, 6);
    if (rest.length > 6) out += '-' + rest.slice(6, 8);
    if (rest.length > 8) out += '-' + rest.slice(8, 10);

    return out;
  }

  phoneInput.addEventListener('focus', function () {
    if (!phoneInput.value) phoneInput.value = '+7 ';
  });

  phoneInput.addEventListener('input', function () {
    phoneInput.value = formatPhone(phoneInput.value);
  });

  phoneInput.addEventListener('blur', function () {
    if (phoneInput.value.replace(/\D/g, '').length <= 1) phoneInput.value = '';
  });

  function setError(field, message) {
    var wrapper = field.closest('.field');
    var errorBox = $('.field__error', wrapper);

    wrapper.classList.toggle('is-invalid', Boolean(message));
    errorBox.textContent = message || '';
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  var validators = {
    name: function (value) {
      if (value.trim().length < 2) return 'Укажите имя — хотя бы два символа';
      if (!/^[А-Яа-яЁёA-Za-z\s'-]+$/.test(value.trim())) return 'Имя может содержать только буквы';
      return '';
    },
    phone: function (value) {
      return value.replace(/\D/g, '').length === 11 ? '' : 'Введите номер полностью: +7 (999) 999-99-99';
    },
    date: function (value) {
      if (!value) return 'Выберите дату визита';
      if (value < toISODate(new Date())) return 'Дата уже прошла';
      return '';
    },
    time: function (value) {
      return value ? '' : 'Выберите время';
    },
    guests: function (value) {
      return value ? '' : 'Укажите количество гостей';
    }
  };

  function validateField(field) {
    var validate = validators[field.name];
    if (!validate) return true;

    var message = validate(field.value);
    setError(field, message);
    return !message;
  }

  $$('.field__input', form).forEach(function (field) {
    field.addEventListener('blur', function () { validateField(field); });

    field.addEventListener('input', function () {
      if (field.closest('.field').classList.contains('is-invalid')) validateField(field);
    });

    field.addEventListener('change', function () {
      if (field.tagName === 'SELECT') validateField(field);
    });
  });

  /** Дата в виде «12 августа», для сообщения об успехе. */
  function humanDate(value) {
    var months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    var parts = value.split('-');
    return parseInt(parts[2], 10) + ' ' + months[parseInt(parts[1], 10) - 1];
  }

  function guestsWord(value) {
    if (value === '9+') return 'большую компанию';
    var count = parseInt(value, 10);
    return count + (count === 1 ? ' гостя' : ' гостей');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var fields = $$('.field__input', form);
    var firstInvalid = null;

    fields.forEach(function (field) {
      if (!validateField(field) && !firstInvalid) firstInvalid = field;
    });

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    var data = new FormData(form);

    // Здесь запрос уходил бы на сервер бронирования.
    successText.textContent = data.get('name').trim() + ', ждём вас ' +
      humanDate(data.get('date')) + ' в ' + data.get('time') +
      ' на ' + guestsWord(data.get('guests')) + '.';

    form.hidden = true;
    success.hidden = false;
    success.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  });

  $('#resetForm').addEventListener('click', function () {
    form.reset();
    $$('.field', form).forEach(function (field) {
      field.classList.remove('is-invalid');
      $('.field__error', field).textContent = '';
    });

    dateInput.value = nearestAvailableDate();
    fillTimeOptions();

    success.hidden = true;
    form.hidden = false;
    $('#name').focus();
  });

  /* ---------------------------------------------------------------------
     Карта: подгружаем по клику, чтобы не тормозить первую загрузку
     --------------------------------------------------------------------- */

  var loadMapBtn = $('#loadMap');

  loadMapBtn.addEventListener('click', function () {
    var map = $('#map');
    var iframe = document.createElement('iframe');

    iframe.src = 'https://www.openstreetmap.org/export/embed.html?bbox=37.5836%2C55.7585%2C37.6036%2C55.7665&layer=mapnik&marker=55.7625%2C37.5936';
    iframe.title = 'Карта: ресторан Shafran, Москва, ул. Малая Бронная, 24';
    iframe.loading = 'lazy';
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');

    map.innerHTML = '';
    map.appendChild(iframe);
  });

  /* ---------------------------------------------------------------------
     Мелочи
     --------------------------------------------------------------------- */

  $('#year').textContent = new Date().getFullYear();
})();
