

export type Language = 'en' | 'id';

export const translations = {
  en: {
    // Nav
    chat: 'Chat',
    tasks: 'Tasks',
    calendar: 'Calendar',
    docs: 'Docs',
    gallery: 'Gallery',
    me: 'Me',
    logout: 'LOGOUT',
    
    // Header
    welcome: 'Welcome',
    
    // Chat UI
    primary_protocol: 'Primary Protocol',
    new_session: 'New Session',
    live_link: 'LIVE LINK',
    web_on: 'WEB: ON',
    web_off: 'WEB: OFF',
    type_command: 'Enter command, Sir...',
    type_command_guest: 'Enter command...',
    pinned: 'PINNED',
    pin_chat: 'PIN CHAT',
    temp_storage: 'TEMP STORAGE',
    upload_options: 'Upload Options',
    upload_device: 'From Device',
    select_gallery: 'From Gallery',
    
    // Auth
    login_title: 'Login',
    register_title: 'Register',
    continue_google: 'Continue with Google',
    select_language: 'Select Language / Pilih Bahasa',
    full_name: 'Full Name',
    country: 'Country',
    city: 'City',
    email: 'Email Address',
    password: 'Password',
    initiate_session: 'INITIATE SESSION',
    create_user: 'CREATE USER',
    forgot_password: 'Forgot Password?',
    back_login: 'Back to Login',
    already_auth: 'Already authorized?',
    access_terminal: 'Access Terminal',
    new_user_prompt: 'New User? Create Protocols',
    register_desc: 'Register for full system access',
    login_desc: 'Access your existing neural link',
    
    // Gender
    gender_male: 'Male (Address as Sir)',
    gender_female: 'Female (Address as Ma\'am)',
    gender_other: 'Other (Neutral)',
    
    // Inputs
    suggest_gmail: 'Append @gmail.com',

    // Live
    live_uplink: 'LIVE UPLINK',
    end_link: 'END LINK',
    listening: 'Listening...',
    consulting: 'Consulting Agent...',
    
    // Profile
    system_prefs: 'System Preferences',
    language: 'Language / Bahasa',
    performance: 'Performance',
    neural_links: 'Neural Links (API Keys)',
    version_info: 'System Version',
    last_updated: 'Last Updated',
    
    // Intro
    intro_topic: "INTRO_ONBOARDING" 
  },
  id: {
    // Nav
    chat: 'Obrolan',
    tasks: 'Tugas',
    calendar: 'Kalender',
    docs: 'Dokumen',
    gallery: 'Galeri',
    me: 'Profil',
    logout: 'KELUAR',
    
    // Header
    welcome: 'Selamat Datang',
    
    // Chat UI
    primary_protocol: 'Protokol Utama',
    new_session: 'Sesi Baru',
    live_link: 'SAMBUNGAN LANGSUNG',
    web_on: 'WEB: AKTIF',
    web_off: 'WEB: MATI',
    type_command: 'Masukkan perintah, Pak...',
    type_command_guest: 'Masukkan perintah...',
    pinned: 'DISEMATKAN',
    pin_chat: 'SEMATKAN',
    temp_storage: 'PENYIMPANAN SEMENTARA',
    upload_options: 'Opsi Unggahan',
    upload_device: 'Dari Perangkat',
    select_gallery: 'Dari Galeri',
    
    // Auth
    login_title: 'Masuk',
    register_title: 'Daftar',
    continue_google: 'Lanjutkan dengan Google',
    select_language: 'Pilih Bahasa',
    full_name: 'Nama Lengkap',
    country: 'Negara',
    city: 'Kota',
    email: 'Alamat Email',
    password: 'Kata Sandi',
    initiate_session: 'MULAI SESI',
    create_user: 'BUAT PENGGUNA',
    forgot_password: 'Lupa Kata Sandi?',
    back_login: 'Kembali ke Masuk',
    already_auth: 'Sudah punya akun?',
    access_terminal: 'Akses Terminal',
    new_user_prompt: 'Pengguna Baru? Buat Protokol',
    register_desc: 'Daftar untuk akses sistem penuh',
    login_desc: 'Akses neural link yang ada',

    // Gender
    gender_male: 'Laki-laki (Panggil Pak)',
    gender_female: 'Perempuan (Panggil Bu)',
    gender_other: 'Lainnya (Netral)',

    // Inputs
    suggest_gmail: 'Tambahkan @gmail.com',
    
    // Live
    live_uplink: 'SAMBUNGAN LANGSUNG',
    end_link: 'AKHIRI',
    listening: 'Mendengarkan...',
    consulting: 'Menghubungi Agen...',
    
    // Profile
    system_prefs: 'Preferensi Sistem',
    language: 'Bahasa',
    performance: 'Performa',
    neural_links: 'Neural Links (Kunci API)',
    version_info: 'Versi Sistem',
    last_updated: 'Terakhir Diperbarui',

    // Intro
    intro_topic: "INTRO_ONBOARDING" 
  }
};

export const getTranslation = (lang: Language | undefined, key: keyof typeof translations['en']) => {
  const l = lang || 'en';
  return translations[l][key] || translations['en'][key];
};