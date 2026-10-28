import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi, type Mock } from 'vitest';
import { ContainerProvider, createContainer } from '../src/core/container';
import type {
  AuthError,
  AuthGateway,
  AuthSession,
  Credentials,
  SignUpInput,
} from '../src/modules/auth';

/**
 * Общие фикстуры для компонентных тестов.
 *
 * Сеть и контейнер подменяются, а формы и хуки — настоящие:
 * тест проверяет поведение пользователя, а не мок.
 */

type AsyncVoid = () => Promise<void>;
type SessionGetter = () => Promise<AuthSession | null>;
type TokenGetter = () => Promise<string | null>;
type CredentialsGetter = (credentials: Credentials) => Promise<void>;
type SignUpGetter = (input: SignUpInput) => Promise<void>;

export type AuthGatewayStub = AuthGateway & {
  signIn: Mock<CredentialsGetter>;
  signUp: Mock<SignUpGetter>;
  signOut: Mock<AsyncVoid>;
  currentSession: Mock<SessionGetter>;
  accessToken: Mock<TokenGetter>;
};

export const SESSION: AuthSession = {
  user: { id: 'user-1', email: 'user@notio.dev', name: 'Аня', emailVerified: true },
  expiresAt: '2026-10-19T00:00:00.000Z',
};

/** Порт аутентификации с типизированными моками всех вызовов. */
export function gatewayStub(overrides: Partial<AuthGateway> = {}): AuthGatewayStub {
  return {
    signUp: vi.fn<SignUpGetter>(async () => undefined),
    signIn: vi.fn<CredentialsGetter>(async () => undefined),
    signOut: vi.fn<AsyncVoid>(async () => undefined),
    currentSession: vi.fn<SessionGetter>(async () => null),
    accessToken: vi.fn<TokenGetter>(async () => null),
    updateUser: vi.fn<AuthGateway['updateUser']>(async () => SESSION.user),
    changeEmail: vi.fn<AuthGateway['changeEmail']>(async () => undefined),
    changePassword: vi.fn<AuthGateway['changePassword']>(async () => undefined),
    deleteAccount: vi.fn<AuthGateway['deleteAccount']>(async () => undefined),
    ...overrides,
  } as AuthGatewayStub;
}

/** Мок вызова без аргументов, который падает с заданной доменной ошибкой. */
export function failsWith(error: AuthError): Mock<AsyncVoid> {
  return vi.fn<AsyncVoid>(async () => {
    throw error;
  });
}

/** Мок запроса сессии, который падает с заданной доменной ошибкой. */
export function sessionFailsWith(error: AuthError): Mock<SessionGetter> {
  return vi.fn<SessionGetter>(async () => {
    throw error;
  });
}

/** Мок сессии: удобно, когда состояние фиксировано. */
export function sessionOf(session: AuthSession | null): Mock<SessionGetter> {
  return vi.fn<SessionGetter>(async () => session);
}

/**
 * Рендерит компонент внутри провайдеров запросов и внедрения зависимостей.
 * Повторы отключены: в тестах мы ждём конкретный исход, а не «попробуем ещё раз».
 */
/** Сообщения для тестов: компактный сабсет, нужный рендерящимся UI. */
export const TEST_MESSAGES = {
  pages: {
    loadFailed: 'Не удалось загрузить страницы',
    rename: {
      title: 'Переименовать страницу',
      inputLabel: 'Название страницы',
      submit: 'Сохранить',
    },
    menu: {
      favoriteAdd: 'Добавить в избранное',
      favoriteRemove: 'Удалить из избранного',
      duplicate: 'Дублировать',
      rename: 'Переименовать',
      copyContent: 'Копировать содержимое',
      lock: 'Заблокировать страницу',
      unlock: 'Разблокировать страницу',
      trash: 'Переместить в корзину',
      copySuccess: 'Содержимое скопировано',
      copyFailed: 'Не удалось скопировать содержимое',
    },
    header: {
      titleLabel: 'Название страницы',
      editedAgo: 'изменено {time}',
      justNow: 'только что',
      minutesAgo: '{count} мин назад',
      hoursAgo: '{count} ч назад',
      daysAgo: '{count} дн назад',
      locked: 'Страница заблокирована',
    },
    favorites: {
      empty: 'Пока нет избранных страниц',
      list: 'Избранные страницы',
      favoritesLoading: 'Загрузка…',
      favoritesLoadFailed: 'Не удалось загрузить избранное',
      favoritesEmpty: 'Пока нет избранных страниц',
      favoritesRemoveFrom: 'Убрать «{title}» из избранного',
    },
    trash: {
      empty: 'Корзина пуста',
      restore: 'Восстановить «{title}»',
      list: 'Удалённые страницы',
      hint: 'Удалённые страницы можно восстановить.',
      favoritesHint: 'Страницы, отмеченные звёздочкой, собраны здесь.',
      trashLoading: 'Загрузка…',
      trashLoadFailed: 'Не удалось загрузить корзину',
    },
  },
  sidebar: {
    favorites: 'Избранное',
    trash: 'Корзина',
    pages: 'Страницы',
    noPages: 'Нет страниц',
    private: 'Личные',
    addNew: 'Создать страницу',
    newChildPage: 'Новая дочерняя страница',
    pageMenu: 'Меню страницы',
    expand: 'Развернуть «{title}»',
    collapse: 'Свернуть «{title}»',
    profile: {
      profile: 'Профиль',
      workspaces: 'Рабочие пространства',
      createWorkspace: 'Создать рабочее пространство',
      workspaceName: 'Название нового рабочего пространства',
      create: 'Создать',
      library: 'Библиотека',
      settings: 'Настройки',
      signOut: 'Выйти',
      signingOut: 'Выходим…',
      signOutFailed: 'Не удалось выйти. Попробуйте ещё раз.',
    },
    loading: 'Загрузка…',
    loadFailed: 'Не удалось загрузить страницы',
    untitledFallback: 'Без названия',
    searchPlaceholder: 'Поиск…',
    closeSidebar: 'Закрыть боковую панель',
    openSidebar: 'Открыть боковую панель',
  },
  search: {
    title: 'Поиск',
    placeholder: 'Поиск страниц…',
    results: 'Результаты поиска ({count})',
    idle: 'Введите название страницы, чтобы найти её в пространстве',
    empty: 'Страницы не найдены',
    loadFailed: 'Не удалось загрузить результаты поиска',
    chips: {
      pages: 'Страницы',
      chats: 'Чаты',
      titleOnly: 'Только заголовок',
      createdBy: 'Автор',
      in: 'В',
      filter: 'Фильтр',
    },
  },

  auth: {
    email: 'Почта',
    password: 'Пароль',
    name: 'Имя',
    signIn: 'Войти',
    signInBusy: 'Входим…',
    signUp: 'Зарегистрироваться',
    signUpBusy: 'Создаём…',
    createAccount: 'Создать аккаунт',
    emailPlaceholder: 'you@example.com',
    namePlaceholder: 'Аня',
    passwordPlaceholder: '••••••••••••',
    errors: {
      emailInvalid: 'Почта выглядит некорректно',
      passwordRequired: 'Укажите пароль',
      passwordShort: 'Пароль не короче 12 символов',
      nameShort: 'Имя не короче 2 символов',
      emailExists: 'Аккаунт с такой почтой уже существует',
      signInFailed: 'Не удалось выполнить вход. Попробуйте снова',
      serviceUnavailable: 'Сервис недоступен. Проверьте соединение',
      verifyEmail: 'Подтвердите почту по ссылке из письма',
      checkSessionFailed: 'Не удалось проверить сессию',
      signupSent: 'Мы отправили ссылку',
      INVALID_CREDENTIALS: 'Неверная почта или пароль',
      EMAIL_NOT_VERIFIED: 'Подтвердите почту по ссылке из письма',
      EMAIL_TAKEN: 'Аккаунт с такой почтой уже существует',
      WEAK_PASSWORD: 'Пароль слишком короткий или длинный',
      INVALID_EMAIL: 'Почта выглядит некорректно',
      RATE_LIMITED: 'Слишком много попыток. Попробуйте позже',
      NETWORK_ERROR: 'Сервис недоступен. Проверьте соединение',
      UNKNOWN: 'Не удалось выполнить вход. Попробуйте снова',
      oauthFailed: 'Не удалось войти через провайдера. Попробуйте ещё раз',
      oauthDenied: 'Провайдер отклонил вход. Разрешите доступ и попробуйте снова',
      oauthExpired: 'Попытка входа истекла. Попробуйте ещё раз',
    },
    noAccount: 'Нет аккаунта?',
    hasAccount: 'Уже есть аккаунт?',
    passwordHint: 'Пароль не короче {count} символов.',
    almostDone: 'Почти готово',
    sentTo: 'Мы отправили ссылку для подтверждения на {email}. Откройте её, затем войдите.',
    goToSignIn: 'Перейти ко входу',
    signInWithProvider: 'Войти через {provider}',
    signUpWithProvider: 'Зарегистрироваться через {provider}',
    INVALID_CREDENTIALS: 'Неверная почта или пароль',
    WEAK_PASSWORD: 'Пароль слишком короткий или длинный',
    RATE_LIMITED: 'Слишком много попыток. Попробуйте позже',
    NETWORK_ERROR: 'Сервис недоступен. Проверьте соединение',
    UNKNOWN: 'Не удалось выполнить вход. Попробуйте снова',
  },
  settings: {
    sections: {
      profile: 'Аккаунт',
      preferences: 'Предпочтения',
      workspaces: 'Рабочие пространства',
      import: 'Импорт',
    },
    confirm: {
      typeToConfirm: 'Введите «{phrase}» для подтверждения',
      mismatch: 'Текст не совпадает',
      cancel: 'Отмена',
      working: 'Удаляем…',
    },
    profile: {
      loading: 'Загрузка профиля…',
      loadFailed: 'Не удалось загрузить профиль',
      email: 'Почта',
      emailVerified: 'Подтверждение почты',
      verified: 'Подтверждена',
      notVerified: 'Не подтверждена',
      userId: 'ID пользователя',
      fullName: 'Имя',
      avatar: 'Аватар',
      changeAvatar: 'Изменить аватар',
      removeAvatar: 'Удалить аватар',
      saved: 'Профиль обновлён',
      saveFailed: 'Не удалось сохранить профиль',
      avatarFailed: 'Не удалось загрузить аватар',
      nameHint: 'Имя видят участники ваших пространств.',
      changeEmail: 'Адрес почты',
      changeEmailHint: 'Текущий адрес: {email}',
      newEmail: 'Новая почта',
      sendConfirmation: 'Отправить ссылку',
      sending: 'Отправляем…',
      emailSent: 'Ссылка отправлена на {email}',
      sameEmail: 'Это уже ваш адрес почты',
      changePassword: 'Пароль',
      passwordHint: 'Не короче {count} символов',
      currentPassword: 'Текущий пароль',
      newPassword: 'Новый пароль',
      repeatPassword: 'Повторите новый пароль',
      changePasswordButton: 'Сменить пароль',
      savingPassword: 'Сохраняем…',
      passwordChanged: 'Пароль изменён',
      passwordMismatch: 'Пароли не совпадают',
      deleteAccount: 'Удаление аккаунта',
      deleteAccountHint: 'Удаление безвозвратно',
      deleteAccountButton: 'Удалить аккаунт',
      deleteAccountTitle: 'Удалить аккаунт?',
      deleteAccountBody: 'Это необратимо',
      deleteAccountConfirm: 'Удалить аккаунт',
      deleteAccountWait: 'Удаление через {seconds} с',
      deleteAccountDone: 'Аккаунт удалён',
      errors: {
        required: 'Заполните поле',
        weakPassword: 'Пароль слишком короткий или длинный',
        INVALID_CREDENTIALS: 'Неверная почта или пароль',
        EMAIL_NOT_VERIFIED: 'Подтвердите почту',
        EMAIL_TAKEN: 'Аккаунт с такой почтой уже существует',
        WEAK_PASSWORD: 'Пароль слишком короткий или длинный',
        INVALID_EMAIL: 'Почта выглядит некорректно',
        INVALID_PASSWORD: 'Текущий пароль неверен',
        PASSWORD_NOT_SET: 'У аккаунта нет пароля',
        SESSION_EXPIRED: 'Сессия слишком стара',
        RATE_LIMITED: 'Слишком много попыток',
        NETWORK_ERROR: 'Сервис недоступен',
        UNKNOWN: 'Что-то пошло не так',
      },
    },
  },
  media: {
    unknownType: 'неизвестен',
    size: { byte: 'Б', kilobyte: 'КБ', megabyte: 'МБ' },
    errors: {
      type: 'Тип {type} не поддерживается',
      size: 'Файл больше лимита {limit}',
      uploadFailed: 'Не удалось загрузить файл',
    },
  },
  library: {
    title: 'Библиотека',
    newPage: 'Новая страница',
    tabs: {
      recent: 'Недавние',
      favorites: 'Избранное',
      shared: 'Общие',
      private: 'Личные',
    },
    columns: {
      name: 'Название',
      createdBy: 'Автор',
      source: 'Источник',
      lastEdited: 'Изменена',
      lastVisited: 'Открывалась',
    },
    columnsTitle: 'Столбцы',
    filter: 'Фильтр',
    filters: { all: 'Все страницы', root: 'Корневые', nested: 'Вложенные' },
    display: 'Отображение',
    search: 'Поиск страниц',
    searchPlaceholder: 'Поиск страниц…',
    sourcePrivate: 'Личная',
    expand: 'Развернуть «{title}»',
    collapse: 'Свернуть «{title}»',
    empty: 'Пока нет страниц',
    emptyFiltered: 'Ничего не найдено',
    loading: 'Загрузка страниц…',
    loadFailed: 'Не удалось загрузить страницы',
    tableLabel: 'Страницы рабочего пространства',
  },
  common: {
    loading: 'Загрузка…',
    save: 'Сохранить',
    cancel: 'Отмена',
    untitled: 'Без названия',
    notFound: 'Ничего не найдено',
    notifications: 'Уведомления',
    dismissNotification: 'Закрыть уведомление',
    close: 'Закрыть',
    breadcrumbLabel: 'Хлебные крошки',
    more: 'Ещё',
  },
  editor: {
    loadingDocument: 'Загрузка документа…',
    loadFailed: 'Не удалось загрузить документ',
    saveFailed: 'Не удалось сохранить документ',
    subPageFailed: 'Не удалось создать страницу',
    saving: 'Сохранение документа',
    dragHandle: { addBelow: 'Добавить блок ниже', blockActions: 'Действия с блоком' },
    imageResize: {
      hint: 'Потяните, чтобы изменить размер',
      fullWidth: 'На всю ширину',
      resize: 'Изменить размер изображения (стрелки влево и вправо)',
      resizeOther: 'Изменить размер изображения с другой стороны',
    },
    media: {
      image: 'Изображение',
      video: 'Видео',
      file: 'Файл',
      emoji: 'Эмодзи',
      captionOptional: 'Подпись (необязательно)',
      chooseFile: 'Выбрать файл',
      orLink: 'или по ссылке',
      insertLink: 'Вставить',
      linkPlaceholder: 'https://…',
      linkInvalid: 'Ссылка должна начинаться с http:// или https://',
      changeEmoji: 'Сменить эмодзи',
      loadingChip: 'Загрузка…',
      page: 'Страница',
      pick: 'Выбрать страницу…',
      lightbox: {
        title: 'Просмотр изображения',
        zoomIn: 'Увеличить',
        zoomOut: 'Уменьшить',
        download: 'Скачать',
        close: 'Закрыть (Esc)',
      },
    },
    equation: {
      expression: 'Выражение формулы',
      remove: 'Удалить формулу',
      hint: 'Ctrl+Enter — готово, Esc — отмена',
      emptyBlock: 'Пустая формула — нажмите, чтобы задать',
      label: 'Формула: {expression}',
    },
    columns: { delete: 'Удалить колонку', addRight: 'Добавить колонку справа' },
    pageLink: {
      pick: 'Выбрать страницу…',
      dialogTitle: 'Выберите страницу',
      searchPlaceholder: 'Поиск по названию…',
      searchLabel: 'Поиск страницы',
      loading: 'Загрузка…',
      empty: 'Ничего не найдено',
      loadingChip: 'Загрузка…',
      page: 'Страница',
    },
    breadcrumb: {
      label: 'Хлебные крошки документа',
      unavailable: 'Крошки недоступны',
      loading: '…',
    },
    table: {
      addRowBelow: 'Добавить строку ниже',
      addColumnRight: 'Добавить колонку справа',
      deleteRow: 'Удалить строку',
      deleteColumn: 'Удалить колонку',
      dragRow: 'Перетащить строку',
      dragColumn: 'Перетащить колонку',
      dragRowHint: 'Перетащите, чтобы переместить строку',
      dragColumnHint: 'Перетащите, чтобы переместить колонку',
    },
    bubble: {
      bold: 'Жирный',
      italic: 'Курсив',
      strike: 'Зачёркнутый',
      code: 'Код',
      link: 'Ссылка',
      textColor: 'Цвет текста',
      background: 'Цвет фона',
      applyLink: 'Применить ссылку',
      removeLink: 'Убрать ссылку',
      resetColor: 'Сбросить цвет',
      linkInvalid: 'Ссылка должна начинаться с http:// или https://',
    },
    slash: {
      menuLabel: 'Вставить блок',
      basics: 'Базовые блоки',
      select: 'выбрать',
      insert: 'вставить',
      esc: 'Esc закрыть',
      commands: {
        text: 'Текст',
        heading1: 'Заголовок 1',
        heading2: 'Заголовок 2',
        heading3: 'Заголовок 3',
        heading4: 'Заголовок 4',
        toggle: 'Toggle-список',
        orderedList: 'Нумерованный список',
        toDo: 'Список задач',
        bulletList: 'Маркированный список',
        quote: 'Цитата',
        divider: 'Разделитель',
        table: 'Таблица',
        page: 'Страница',
        code: 'Код',
        image: 'Изображение',
        video: 'Видео',
        file: 'Файл',
        emoji: 'Эмодзи',
        'columns-2': '2 колонки',
        'columns-3': '3 колонки',
        'columns-4': '4 колонки',
        'columns-5': '5 колонок',
        equation: 'Формула',
        'inline-equation': 'Строчная формула',
        'link-to-page': 'Ссылка на страницу',
        breadcrumb: 'Хлебные крошки',
      },
    },
    colors: {
      gray: 'Серый',
      brown: 'Коричневый',
      orange: 'Оранжевый',
      yellow: 'Жёлтый',
      green: 'Зелёный',
      blue: 'Синий',
      purple: 'Фиолетовый',
      pink: 'Розовый',
      red: 'Красный',
    },
    blockActions: {
      menuLabel: 'Действия с блоком',
      turnInto: 'Превратить в',
      color: 'Цвет',
      duplicate: 'Дублировать',
      delete: 'Удалить',
      download: 'Скачать',
      replace: 'Заменить',
      textColor: 'Текст',
      background: 'Фон',
      resetColor: 'Сбросить цвет',
      backToActions: 'Назад к действиям блока',
      blockColor: 'Цвет блока',
      turnIntoOption: {
        text: 'Текст',
        heading1: 'Заголовок 1',
        heading2: 'Заголовок 2',
        heading3: 'Заголовок 3',
        heading4: 'Заголовок 4',
        toDo: 'Список задач',
        bulletedList: 'Маркированный список',
        numberedList: 'Нумерованный список',
        toggle: 'Toggle-список',
        quote: 'Цитата',
        code: 'Код',
        file: 'Файл',
      },
    },
  },
};

export function renderWithIntl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="ru" messages={TEST_MESSAGES}>
      {ui}
    </NextIntlClientProvider>,
  );
}

export function renderWithProviders(ui: ReactElement, gateway: AuthGateway) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <NextIntlClientProvider locale="ru" messages={TEST_MESSAGES}>
      <QueryClientProvider client={queryClient}>
        <ContainerProvider container={createContainer(gateway)}>{ui}</ContainerProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}
