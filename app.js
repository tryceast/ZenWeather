// app.js

// Konstanta BMKG API
const BMKG_BASE_URL = 'https://api.bmkg.go.id/publik/prakiraan-cuaca';

// URL Data Wilayah (Format SQL)
const WILAYAH_SQL_URL = 'https://raw.githubusercontent.com/cahyadsn/wilayah/refs/heads/master/db/wilayah.sql';

const appContent = document.getElementById('app-content');
const loaderHTML = `
    <div class="flex flex-col items-center justify-center py-32">
        <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#2B8A9E]"></div>
        <p class="mt-4 text-xl font-medium text-[#2C2C2C]">Mengambil prakiraan cuaca...</p>
    </div>
`;


// Variabel untuk menyimpan data kode wilayah (ADM4: Desa/Kelurahan)
let adm4Data = null; 
let isLoadingAdm4 = false;

// Variabel baru untuk menyimpan peta nama wilayah (Provinsi, KotKab, Kecamatan)
let wilayahMap = {};

// Bagian yang akan dipantau oleh Scroll Spy
const sections = [
    { id: 'hero', navId: 'nav-link-home' },
    { id: 'details-feature', navId: 'nav-link-feature' },
    { id: 'contact', navId: 'nav-link-contact' }
];

// Data ikon dan nama BMKG
const BMKG_ICON_MAP = {
    '0': 'https://openweathermap.org/img/wn/01d@4x.png', // Cerah
    '1': 'https://openweathermap.org/img/wn/02d@4x.png', // Cerah Berawan
    '2': 'https://openweathermap.org/img/wn/03d@4x.png', // Cerah Berawan
    '3': 'https://openweathermap.org/img/wn/03d@4x.png', // Berawan
    '4': 'https://openweathermap.org/img/wn/04d@4x.png', // Berawan Tebal
    '5': 'https://openweathermap.org/img/wn/50d@4x.png', // Kabut
    '10': 'https://openweathermap.org/img/wn/50d@4x.png', // Udara Kabur/Asap
    '45': 'https://openweathermap.org/img/wn/10d@4x.png', // Hujan Ringan
    '60': 'https://openweathermap.org/img/wn/09d@4x.png', // Hujan Sedang
    '61': 'https://openweathermap.org/img/wn/10d@4x.png', // Hujan Ringan
    '63': 'https://openweathermap.org/img/wn/09d@4x.png', // Hujan Sedang
    '80': 'https://openweathermap.org/img/wn/10d@4x.png', // Hujan Lokal
    '95': 'https://openweathermap.org/img/wn/11d@4x.png', // Hujan Petir
    '97': 'https://openweathermap.org/img/wn/11d@4x.png', // Hujan Petir
    'default': 'https://openweathermap.org/img/wn/01d@4x.png'
};

const BG_CLASS_MAP = {
    'clear': 'bg-weather-clear',
    'cloudy': 'bg-weather-cloudy',
    'rain': 'bg-weather-rain',
    'storm': 'bg-weather-storm'
};

/**
 * Mengelola state link navigasi yang aktif (underline).
 */
function setActiveNavLink(activeId) {
    sections.forEach(section => {
        const navLink = document.getElementById(section.navId);
        if (navLink) {
            if (section.id === activeId) {
                navLink.classList.add('nav-link-active');
            } else {
                navLink.classList.remove('nav-link-active');
            }
        }
    });
}
/**
 * Mengubah link Home di navbar menjadi "Kembali ke Pencarian".
 */
function setNavToBackToSearch(isDetailView) {
    const navLink = document.getElementById('nav-link-home');
    const navText = document.getElementById('nav-home-text');
    
    if (!navLink || !navText) return;

    if (isDetailView) {
        // Tampilan Mode Detail
        navText.textContent = "Home";
        // Ganti href ke '#' agar me-reset router
        navLink.setAttribute('href', '#'); 
        // Hapus kelas smooth-scroll karena kita ingin fungsi router() berjalan
        navLink.classList.remove('smooth-scroll'); 
        navLink.classList.add('nav-link-special'); // Opsional: Beri kelas khusus jika perlu styling
        navLink.classList.remove('nav-link-active'); // Hapus aktif karena ini bukan section

        // Pastikan event listener untuk kembali ke pencarian sudah diatur di router
        navLink.onclick = function(e) {
            e.preventDefault();
            history.replaceState(null, null, window.location.pathname);
            router(); // Panggil router untuk memuat ulang homepage
        };

    } else {
        // Tampilan Mode Normal (Home, Contact, Feature)
        navText.textContent = "Home";
        navLink.setAttribute('href', '#hero');
        navLink.classList.add('smooth-scroll'); 
        navLink.classList.remove('nav-link-special');
        
        // Kembalikan ke fungsi smooth scroll
        navLink.onclick = null; 
        navLink.addEventListener('click', function (e) {
            // Memastikan fungsi smooth scroll default berjalan
            if (this.classList.contains('smooth-scroll')) {
                e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    const headerHeight = document.getElementById('zen-navbar').offsetHeight + 20; 
                    window.scrollTo({
                        top: targetElement.offsetTop - headerHeight,
                        behavior: 'smooth'
                    });
                }
            }
        });
    }
}

/**
 * Membuat elemen hujan latar belakang dan droplet di layar (diam + animasi turun).
 */
function createRain() {
    // 1. SETUP CONTAINER HUJAN LATAR BELAKANG
    const rainContainer = document.getElementById('rain-container');
    
    if (rainContainer) {
        rainContainer.innerHTML = ''; // Bersihkan hujan lama
        const dropCount = 80; // Jumlah air hujan di background

        for (let i = 0; i < dropCount; i++) {
            const drop = document.createElement('div');
            drop.classList.add('rain-drop');
            
            // Random posisi kiri-kanan (0-100vw)
            drop.style.left = Math.random() * 100 + 'vw';
            // Random durasi jatuh (0.5s - 1s) agar tidak seragam
            drop.style.animationDuration = (Math.random() * 0.5 + 0.5) + 's'; 
            // Random delay biar tidak mulai bareng
            drop.style.animationDelay = Math.random() * 2 + 's'; 
            drop.style.opacity = Math.random(); // Transparansi acak
            
            rainContainer.appendChild(drop);
        }
    }

    // 2. SETUP CONTAINER DROPLET (TITIK AIR DI LENSA/LAYAR)
    const dropletContainer = document.getElementById('screen-droplets');
    
    if (dropletContainer) {
        dropletContainer.innerHTML = ''; // Bersihkan droplet lama
        
        // A. BUAT DROPLET DIAM (EMBUN)
        const staticDroplets = 10;
        for(let j = 0; j < staticDroplets; j++) {
             const droplet = document.createElement('div');
             droplet.classList.add('droplet');
             
             // Ukuran acak 10px - 30px
             const size = (Math.random() * 20 + 10) + 'px';
             droplet.style.width = size;
             droplet.style.height = size;
             
             // Posisi acak di seluruh layar
             droplet.style.top = Math.random() * 100 + 'vh';
             droplet.style.left = Math.random() * 100 + 'vw';
             
             dropletContainer.appendChild(droplet);
        }

        // B. BUAT DROPLET YANG MELUNCUR TURUN (ANIMASI)
        const slidingDroplets = 5; 
        for(let k = 0; k < slidingDroplets; k++) {
            const slideDrop = document.createElement('div');
            slideDrop.classList.add('droplet', 'slide-down'); // Tambahkan class slide-down
            
            // Ukuran sedikit lebih besar untuk efek tetesan berat (15px - 35px)
            const size = (Math.random() * 20 + 15) + 'px';
            slideDrop.style.width = size;
            slideDrop.style.height = size;
            
            // Posisi awal random horizontal, vertikal agak ke atas (0-40vh)
            slideDrop.style.left = Math.random() * 100 + 'vw';
            slideDrop.style.top = Math.random() * 40 + 'vh';
            
            // PENTING: Delay animasi acak (0s sampai 5s) 
            // Supaya mereka turun bergantian, tidak barengan.
            slideDrop.style.animationDelay = Math.random() * 5 + 's';
            
            // Durasi turun acak (3s - 6s)
            slideDrop.style.animationDuration = (Math.random() * 3 + 3) + 's';

            dropletContainer.appendChild(slideDrop);
        }
    }
}

const BACKGROUND_ELEMENT = document.getElementById('zenwood-bg-gradient');
const SUN_ELEMENT = document.getElementById('sun-element');
const RAIN_CONTAINER = document.getElementById('rain-container');
const DROPLET_CONTAINER = document.getElementById('screen-droplets');
const CLOUD_LAYER = document.getElementById('cloud-layer');
/**
 * Mengatur efek visual (Matahari, Hujan, Awan) DAN Audio (Hujan Biasa vs Badai)
 */
function updateAppBackground(weatherCode) {
    
    // Siapkan elemen visual
    const SUN_ELEMENT = document.getElementById('sun-element');
    const RAIN_CONTAINER = document.getElementById('rain-container');
    const DROPLET_CONTAINER = document.getElementById('screen-droplets');
    const CLOUD_LAYER = document.getElementById('cloud-layer');

    // Siapkan elemen audio
    const RAIN_AUDIO = document.getElementById('rain-sfx'); 
    const STORM_AUDIO = document.getElementById('storm-sfx');

    // --- FUNGSI HELPER AUDIO ---
    const playSound = (audioEl) => {
        if (audioEl) {
            audioEl.volume = 0.5; 
            // Pastikan reset ke awal biar tidak "melanjutkan" jika sebelumnya dipause
            if (audioEl.paused) { 
                audioEl.currentTime = 0; 
                audioEl.play().catch(e => console.log("Audio autoplay blocked:", e));
            }
        }0
    };

    const stopSound = (audioEl) => {
        if (audioEl) {
            audioEl.pause();
            audioEl.currentTime = 0;
        }
    };

    const stopAllSounds = () => {
        stopSound(RAIN_AUDIO);
        stopSound(STORM_AUDIO);
    };

    // 1. RESET AWAL VISUAL
    if(RAIN_CONTAINER) RAIN_CONTAINER.classList.remove('fade-out');
    if(DROPLET_CONTAINER) DROPLET_CONTAINER.classList.remove('fade-out');
    
    // --- MODE HOME / KEMBALI KE PENCARIAN (RESET) ---
    if (weatherCode === null || weatherCode === undefined) {
        
        // A. Matikan SEMUA Audio
        stopAllSounds();

        // B. Animasi Matahari Keluar
        if (SUN_ELEMENT && SUN_ELEMENT.classList.contains('sun-enter')) {
            SUN_ELEMENT.classList.remove('sun-enter');
            SUN_ELEMENT.classList.add('sun-exit');
        }

        // C. Fade Out Visual Hujan
        if(RAIN_CONTAINER) RAIN_CONTAINER.classList.add('fade-out');
        if(DROPLET_CONTAINER) DROPLET_CONTAINER.classList.add('fade-out');
        
        // D. Reset Awan
        if(CLOUD_LAYER) CLOUD_LAYER.classList.remove('clouds-dense'); 

        // E. Bersihkan elemen setelah transisi 1 detik
        setTimeout(() => {
             if(RAIN_CONTAINER) RAIN_CONTAINER.classList.add('hidden');
             if(DROPLET_CONTAINER) DROPLET_CONTAINER.classList.add('hidden');
             if (SUN_ELEMENT) SUN_ELEMENT.classList.remove('sun-exit');
        }, 1000); 

        return; 
    }

    // --- MODE DETAIL CUACA ---
    
    const code = parseInt(weatherCode, 10);
    let isSunny = false;
    let isRainy = false;
    let isStorm = false;      // Flag khusus Badai
    let isCloudyDense = false;

    // Logika Cuaca
    if (code === 0 || code === 1 || code === 100) {
        // Cerah
        isSunny = true;
    } else if (code >= 2 && code <= 4) {
        // Berawan
        isCloudyDense = true;
    } else if ((code >= 5 && code <= 98) || code === 60 || code === 61 || code === 95 || code === 97) {
        // Kategori Hujan
        isRainy = true;
        isCloudyDense = true; 
        
        // Cek Spesifik Badai Petir (Kode 95 & 97)
        if (code === 95 || code === 97) {
            isStorm = true;
        }
    }

    // 2. EFEK MATAHARI
    if (isSunny) {
        if (SUN_ELEMENT) {
            SUN_ELEMENT.classList.remove('hidden', 'sun-exit');
            SUN_ELEMENT.classList.add('sun-enter');
        }
    } else {
        if (SUN_ELEMENT && !SUN_ELEMENT.classList.contains('sun-exit')) {
            SUN_ELEMENT.classList.add('hidden'); 
            SUN_ELEMENT.classList.remove('sun-enter');
        }
    }

    // 3. EFEK HUJAN & AUDIO (LOGIKA UPDATE)
    if (isRainy) {
        // Tampilkan Visual
        createRain(); 
        if(RAIN_CONTAINER) RAIN_CONTAINER.classList.remove('hidden'); 
        if(DROPLET_CONTAINER) DROPLET_CONTAINER.classList.remove('hidden'); 
        
        // Putar Audio yang Sesuai
        if (isStorm) {
            // Jika Badai: Stop Hujan Biasa, Play Badai
            stopSound(RAIN_AUDIO);
            playSound(STORM_AUDIO);
        } else {
            // Jika Hujan Biasa: Stop Badai, Play Hujan Biasa
            stopSound(STORM_AUDIO);
            playSound(RAIN_AUDIO);
        }

    } else {
        // Tidak Hujan: Sembunyikan Visual & Matikan Suara
        if(RAIN_CONTAINER) RAIN_CONTAINER.classList.add('hidden');
        if(DROPLET_CONTAINER) DROPLET_CONTAINER.classList.add('hidden');
        
        stopAllSounds();
    }

    // 4. EFEK AWAN
    if (isCloudyDense) {
        if(CLOUD_LAYER) CLOUD_LAYER.classList.add('clouds-dense');
    } else {
        if(CLOUD_LAYER) CLOUD_LAYER.classList.remove('clouds-dense');
    }
}


// --- UTILITY FUNCTIONS ---

function showNotification(message) {
    const notificationEl = document.getElementById('error-notification');
    const messageEl = document.getElementById('notification-message');
    
    if (!notificationEl || !messageEl) return;

    messageEl.textContent = message;
    notificationEl.classList.remove('translate-x-full');

    setTimeout(() => {
        notificationEl.classList.add('translate-x-full');
    }, 4000); 
}

function parseHash() {
    const hash = window.location.hash.substring(1);
    const parts = hash.split('?');
    const page = parts[0] || 'hero';
    const params = {};

    if (parts.length > 1) {
        parts[1].split('&').forEach(param => {
            const [key, value] = param.split('=');
            if (key && value) {
                params[key] = decodeURIComponent(value.replace(/\+/g, ' '));
            }
        });
    }
    return { page, params };
}

// --- NEW WILAYAH PARSER (SQL BASED) ---

/**
 * Mengambil dan mem-parsing data kode wilayah dari file SQL mentah.
 * Menggunakan Regex untuk mengekstrak VALUES ('kode', 'nama').
 */
async function loadAdm4Data() {
    if (adm4Data) return adm4Data; // Gunakan cache jika sudah ada
    if (isLoadingAdm4) return [];

    isLoadingAdm4 = true;
    try {
        console.log("Mengunduh data wilayah SQL...");
        const response = await fetch(WILAYAH_SQL_URL);
        if (!response.ok) {
            throw new Error(`Gagal memuat data kode wilayah: ${response.status}`);
        }
        
        const sqlText = await response.text();
        
        const tempWilayahMap = {}; // Untuk mapping kode -> nama (Prov/Kab/Kec)
        const tempAdm4Data = [];   // Array khusus Desa/Kelurahan untuk pencarian

        // REGEX untuk menangkap pattern: ('11.01.01.2001','Keude Bakongan')
        // Penjelasan:
        // \('        -> Mencari karakter kurung buka dan petik satu
        // ([\d\.]+)  -> Group 1: Mengambil angka dan titik (Kode)
        // ',         -> Mencari petik penutup kode dan koma
        // \s* -> Toleransi spasi (jika ada)
        // '          -> Petik pembuka nama
        // ([^']+)    -> Group 2: Mengambil semua karakter KECUALI petik (Nama)
        // '\)        -> Petik penutup nama dan kurung tutup
        const regex = /\('([\d\.]+)',\s*'([^']+)'\)/g;
        
        let match;
        // Loop melalui semua kecocokan regex di teks SQL
        while ((match = regex.exec(sqlText)) !== null) {
            const code = match[1];
            const name = match[2].replace(/\\'/g, "'"); // Handle escaped quotes jika ada

            // Logika pemisahan berdasarkan panjang kode (Hierarchy):
            // 2 digit = Provinsi (11)
            // 5 digit = Kab/Kota (11.01)
            // 8 digit = Kecamatan (11.01.01)
            // 13 digit = Desa/Kelurahan (11.01.01.2001)

            if (code.length === 13) {
                // Ini adalah Desa/Kelurahan -> Masukkan ke array pencarian
                tempAdm4Data.push({
                    code: code,
                    name: name
                });
            } else {
                // Ini adalah Prov/Kab/Kec -> Masukkan ke Map untuk referensi nama parent
                tempWilayahMap[code] = name;
            }
        }

        // Simpan map wilayah global
        wilayahMap = tempWilayahMap;

        // Perkaya data Desa dengan nama parent (Prov/Kab/Kec)
        // Format kode desa: AA.BB.CC.DDDD
        adm4Data = tempAdm4Data.map(item => {
            const code = item.code;
            
            // Ambil Kode Parent
            const provCode = code.substring(0, 2);       // AA
            const kotkabCode = code.substring(0, 5);     // AA.BB
            const kecCode = code.substring(0, 8);        // AA.BB.CC
            
            // Lookup nama dari Map
            const provName = wilayahMap[provCode] || '';
            const kotkabName = wilayahMap[kotkabCode] || '';
            const kecName = wilayahMap[kecCode] || '';
            
            return {
                ...item,
                provName: provName,
                kotkabName: kotkabName,
                kecName: kecName // Tambahan info Kecamatan
            };
        });

        console.log(`Berhasil memuat ${adm4Data.length} desa/kelurahan.`);
        isLoadingAdm4 = false;
        return adm4Data;
        
    } catch (error) {
        isLoadingAdm4 = false;
        console.error("Error loading Wilayah SQL data:", error);
        showNotification("Gagal memuat data kode wilayah. Coba refresh halaman.");
        return [];
    }
}

/**
 * Mencari kode ADM4 berdasarkan nama Desa/Kelurahan yang diinput pengguna (mendukung kombinasi nama).
 */
function findAdm4Code(villageName) {
    if (!adm4Data) return null;
    
    // --- START: LOGIKA BARU PENCARIAN FLEKSIBEL ---
    // 1. Normalisasi input: Pisahkan query menjadi token/kata kunci
    // Ganti koma dengan spasi, lalu pisahkan dengan spasi, filter kata kunci yang terlalu pendek
    const searchTokens = villageName.toUpperCase().replace(/,+/g, ' ').trim().split(/\s+/).filter(t => t.length > 1);

    if (searchTokens.length === 0) return null;

    // Fungsi pembantu untuk membuat string pencarian konteks
    const createSearchContext = (item) => {
        // Gabungkan nama Desa, Kecamatan, KotKab, Prov dengan spasi
        return `${item.name} ${item.kecName} ${item.kotkabName} ${item.provName}`.toUpperCase();
    };

    // 2. Cari kecocokan terbaik:
    let result = adm4Data.find(item => {
        const context = createSearchContext(item);
        // Cek apakah konteks mengandung SEMUA token (kata kunci) yang diinput pengguna
        return searchTokens.every(token => context.includes(token));
    });
    
    return result || null;
    // --- END: LOGIKA BARU PENCARIAN FLEKSIBEL ---
}

/**
 * Mencari 5 Desa/Kelurahan yang paling cocok untuk autosuggestion (mendukung kombinasi nama).
 */
function searchAdm4ForSuggestion(query) {
    if (!adm4Data || query.length < 2) return [];
    
    // --- START: LOGIKA BARU PENCARIAN FLEKSIBEL ---
    // 1. Normalisasi input: Pisahkan query menjadi token/kata kunci
    const searchTokens = query.toUpperCase().replace(/,+/g, ' ').trim().split(/\s+/).filter(t => t.length > 1);
    
    if (searchTokens.length === 0) return [];

    const createSearchContext = (item) => {
        // Gabungkan nama Desa, Kecamatan, KotKab, Prov dengan spasi
        return `${item.name} ${item.kecName} ${item.kotkabName} ${item.provName}`.toUpperCase();
    };

    // Filter data
    return adm4Data
        .filter(item => {
            const context = createSearchContext(item);
            // Cek apakah konteks mengandung SEMUA token (kata kunci) yang diinput pengguna
            return searchTokens.every(token => context.includes(token));
        })
        .slice(0, 5);
    // --- END: LOGIKA BARU PENCARIAN FLEKSIBEL ---
}


// --- NEW UTILITY FOR 3-DAY FORECAST ---

/**
 * Mengelompokkan data cuaca per jam menjadi data harian (Ambil data paling pagi/siang sebagai representasi)
 * @param {Array} cuacaData - Array prakiraan cuaca dari BMKG (data.data[0].cuaca).
 * @returns {object} - Objek yang dikelompokkan per tanggal.
 */
function groupForecastByDay(cuacaData) {
    const dailyForecast = {};
    
    // Flatten array of arrays menjadi satu array jadwal cuaca.
    // **PERBAIKAN MINOR**: Tambahkan filter untuk memastikan item dan local_datetime ada.
    const flatForecast = cuacaData.flat(2).filter(f => f && f.datetime && f.local_datetime);

    flatForecast.forEach(forecast => {
        const dateKey = forecast.local_datetime.substring(0, 10); // Format YYYY-MM-DD
        
        if (!dailyForecast[dateKey]) {
            dailyForecast[dateKey] = {
                date: dateKey,
                minTemp: forecast.t,
                maxTemp: forecast.t,
                morning: null, // Sekitar jam 7 pagi (00:00:00Z) atau 07:00:00 WIB
                afternoon: null, // Sekitar jam 1 siang (06:00:00Z) atau 13:00:00 WIB
                evening: null, // Sekitar jam 7 malam (12:00:00Z) atau 19:00:00 WIB
            };
        }

        // Update suhu Min/Max
        if (forecast.t < dailyForecast[dateKey].minTemp) {
            dailyForecast[dateKey].minTemp = forecast.t;
        }
        if (forecast.t > dailyForecast[dateKey].maxTemp) {
            dailyForecast[dateKey].maxTemp = forecast.t;
        }
        
        // Coba tentukan waktu (berdasarkan local_datetime)
        const localHour = new Date(forecast.local_datetime).getHours();

        if (localHour >= 6 && localHour < 12 && (!dailyForecast[dateKey].morning || forecast.tcc > dailyForecast[dateKey].morning.tcc)) {
            // Ambil ramalan dengan tutupan awan (tcc) tertinggi di pagi hari
            dailyForecast[dateKey].morning = forecast;
        } else if (localHour >= 12 && localHour < 18 && (!dailyForecast[dateKey].afternoon || forecast.tcc > dailyForecast[dateKey].afternoon.tcc)) {
            // Ambil ramalan dengan tutupan awan (tcc) tertinggi di siang hari
             dailyForecast[dateKey].afternoon = forecast;
        } else if (localHour >= 18 && localHour <= 23 && (!dailyForecast[dateKey].evening || forecast.tcc > dailyForecast[dateKey].evening.tcc)) {
            // Ambil ramalan dengan tutupan awan (tcc) tertinggi di malam hari
            dailyForecast[dateKey].evening = forecast;
        } else if (localHour >= 0 && localHour < 6 && !dailyForecast[dateKey].morning) {
             // Ambil jika belum ada data pagi, atau jika ini cuaca yang lebih signifikan
             dailyForecast[dateKey].morning = forecast;
        }
    });

    // Urutkan berdasarkan tanggal
    const sortedDays = Object.values(dailyForecast).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Batasi 2 hari ke depan (termasuk hari ini)
    return sortedDays.slice(0, 3);
}

/**
 * Helper untuk format tanggal
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(today.getDate() + 2);

    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0);

    if (targetDate.getTime() === today.getTime()) {
        return "Hari Ini";
    } else if (targetDate.getTime() === tomorrow.getTime()) {
        return "Besok";
    } else if (targetDate.getTime() === dayAfterTomorrow.getTime()) {
        return "Lusa";
    } else {
        return date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
    }
}


// --- RENDER FUNCTIONS ---

/**
 * Renders the initial search interface.
 */
function renderHomePage() {
    appContent.innerHTML = `
        <section id="hero" class="pt-24 pb-32 text-center" style="min-height: 400px;">
            <h1 class="h1-zen max-w-4xl mx-auto mb-6 animated-item animation-delay-1200">Prakiraan Cuaca Indonesia (BMKG)</h1>
            <p class="body-lg-zen max-w-2xl mx-auto mb-10 animated-item animation-delay-1400">Masukkan nama Desa atau Kelurahan untuk mendapatkan prakiraan cuaca BMKG terkini.</p>
            
            <form id="weather-search-form" class="flex justify-center mb-16 animated-item animation-delay-1600">
                <div class="bg-white rounded-[24px] shadow-lg p-3 w-full max-w-2xl relative" style="box-shadow: rgb(207, 207, 207) 0px -3px 0px inset;">
                    
                    <div class="flex gap-4">
                        <input type="text" id="village-search-input" placeholder="Masukkan nama Desa/Kelurahan, Kota, Provinsi..." 
                               class="flex-grow p-4 rounded-[16px] border-2 border-gray-200 focus:border-[#2B8A9E] transition duration-200 text-[#2C2C2C] text-lg outline-none" 
                               style="box-shadow: none;" required>
                        <button type="submit" id="search-btn" class="btn-primary-zen flex-shrink-0 px-8 py-3">Cari</button>
                    </div>

                    <ul id="suggestion-list" class="absolute z-10 w-[95%] left-1/2 -translate-x-1/2 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto hidden">
                        </ul>
                </div>
            </form>

            </section>
    `;

    // 1. Initialize ADM4 data loading immediately
    loadAdm4Data(); 

    // 2. Attach event listeners for the search form and autosuggestion
    const searchForm = document.getElementById('weather-search-form');
    const inputElement = document.getElementById('village-search-input');
    const suggestionList = document.getElementById('suggestion-list');

    // Handle form submission (using exact code or best guess from input)
    searchForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const villageName = inputElement.value.trim();
        suggestionList.classList.add('hidden'); // Sembunyikan suggestions

        if (villageName) {
            // Tampilkan loading sebelum mencari kode wilayah
            appContent.innerHTML = loaderHTML;

            // Pastikan data sudah dimuat sebelum mencari
            await loadAdm4Data(); 

            // Cari kode wilayah. findAdm4Code akan mencari kecocokan terbaik (exact/partial)
            const adm4Info = findAdm4Code(villageName);
            
            if (adm4Info) {
                fetchWeatherData(adm4Info.code, adm4Info.name);
            } else {
                // Saat gagal, kembalikan ke home dan tampilkan notifikasi
                renderHomePage(); 
                inputElement.value = villageName; // Kembalikan nilai input
                showNotification(`Kode wilayah untuk Desa/Kelurahan "${villageName}" tidak ditemukan. Coba nama lain atau periksa ejaan.`);
            }
        }
    });

    // Handle autosuggestion on input
    inputElement.addEventListener('input', function() {
        const query = this.value.trim();
        suggestionList.innerHTML = ''; // Kosongkan list sebelumnya

        if (query.length > 1 && adm4Data) {
            const suggestions = searchAdm4ForSuggestion(query);
            
            if (suggestions.length > 0) {
                suggestionList.classList.remove('hidden'); // Tampilkan list
                suggestions.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'p-3 text-left cursor-pointer hover:bg-gray-100 transition duration-150 text-[#2C2C2C] text-base border-b border-gray-100 last:border-b-0';
                    
                    // Format tampilan: Desa/Kelurahan, Kecamatan, Kota/Kabupaten, Provinsi
                    const displayContext = [];
                    if (item.kecName) displayContext.push(item.kecName);
                    if (item.kotkabName) displayContext.push(item.kotkabName);
                    if (item.provName) displayContext.push(item.provName);

                    let displayText = item.name;
                    if (displayContext.length > 0) {
                        // Tampilkan nama desa/kelurahan sebagai yang utama, sisanya kecil di samping
                        displayText += `, <span class="text-sm text-gray-500">${displayContext.join(', ')}</span>`;
                    }
                    
                    li.innerHTML = displayText;

                    // Simpan data kode di element
                    li.dataset.code = item.code;
                    li.dataset.name = item.name;

                    li.addEventListener('click', function() {
                        // 1. Isi input dengan nama Desa/Kelurahan yang dipilih
                        inputElement.value = this.dataset.name;
                        
                        // 2. Sembunyikan list
                        suggestionList.classList.add('hidden');
                        suggestionList.innerHTML = ''; 
                        
                        // 3. Langsung fetch data BMKG
                        appContent.innerHTML = loaderHTML;
                        fetchWeatherData(this.dataset.code, this.dataset.name);
                    });

                    suggestionList.appendChild(li);
                });
            } else {
                 suggestionList.classList.add('hidden'); // Sembunyikan jika tidak ada hasil
            }
        } else {
             suggestionList.classList.add('hidden');
        }
    });

    // Sembunyikan suggestion list jika mengklik di luar input/list
    document.addEventListener('click', function(e) {
        if (!searchForm.contains(e.target)) {
            suggestionList.classList.add('hidden');
        }
    });

    // Re-initialize scroll spy setelah render
    setTimeout(initScrollSpy, 100);
}
/**
 * Renders the full weather detail page using BMKG data.
 * LOGIC FIX: Strict Closest Time Match (Tanpa Label Perkiraan).
 */
function renderDetailPage(villageName, data) {
    const lokasi = data.lokasi;
    const cuacaArea = data.data; 

    // Validasi data
    if (!cuacaArea || cuacaArea.length === 0 || !cuacaArea[0].cuaca || cuacaArea[0].cuaca.length === 0) {
        appContent.innerHTML = `<section class="pt-24 pb-32 text-center"><h2 class="h2-zen">Data Cuaca Tidak Lengkap</h2><p>Tidak dapat memuat prakiraan cuaca terkini untuk ${villageName}.</p></section>`;
        return;
    }
    
    const cuacaData = cuacaArea[0].cuaca;

    // --- LOGIKA PENCARIAN WAKTU TERDEKAT (STRICT) ---
    
    // 1. Gabungkan semua data cuaca menjadi satu list panjang
    // **Perbaikan Minor**: Menambahkan filter untuk mencegah error jika ada item null/tanpa local_datetime
    const flatForecast = cuacaData.flat(2).filter(f => f && f.local_datetime); 
    
    // 2. Waktu sistem saat ini
    const now = new Date();

    // 3. Cari data dengan selisih waktu paling kecil
    let closestForecast = null;
    let minDiff = Infinity; // Mulai dengan angka tak terhingga

    flatForecast.forEach(item => {
        const itemTime = new Date(item.local_datetime);
        // Hitung selisih mutlak (absolute) dalam milidetik
        const diff = Math.abs(now - itemTime);

        // Jika selisih ini lebih kecil dari selisih sebelumnya, jadikan ini kandidat utama
        if (diff < minDiff) {
            minDiff = diff;
            closestForecast = item;
        }
    });

    // Fallback (jaga-jaga jika array kosong, meski sudah divalidasi di atas)
    const finalData = closestForecast || flatForecast[0];
    
    if (!finalData) {
        appContent.innerHTML = `<section class="pt-24 pb-32 text-center"><h2 class="h2-zen">Data Cuaca Tidak Ditemukan</h2><p>Tidak ada titik prakiraan cuaca yang valid untuk ${villageName}.</p></section>`;
        return;
    }

    // 4. AMBIL JAM DARI DATA BMKG (Bukan jam sistem)
    const dataTime = new Date(finalData.local_datetime);
    
    // Format tampilan: "10:00" atau "13:00"
    // replace('.', ':') digunakan karena default locale ID kadang pakai titik
    const timeDisplay = dataTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

    // --- AKHIR LOGIKA PENCARIAN ---


    // --- DATA TEMPERATUR & CUACA DARI HASIL FILTER DI ATAS ---
    const currentTemp = finalData.t; 
    const currentWeatherCode = String(finalData.weather); 
    const currentHumidity = finalData.hu; 
    // Konversi Angin: m/s ke km/j (m/s * 3600 / 1000)
    const currentWindSpeed = finalData.ws * 3.6; 
    const descriptionText = finalData.weather_desc;
    
    // --- START: KODE BARU UNTUK BACKGROUND ---
    updateAppBackground(currentWeatherCode); 
    // --- END: KODE BARU UNTUK BACKGROUND ---

    // Hitung Min/Max suhu global (dari semua data yang ada)
    let tempMin = Infinity;
    let tempMax = -Infinity;
    cuacaArea.forEach(areaData => {
        areaData.cuaca.forEach(periodArray => {
            periodArray.forEach(forecast => {
                if (forecast.t < tempMin) tempMin = forecast.t;
                if (forecast.t > tempMax) tempMax = forecast.t;
            });
        });
    });

    // --- RENDER 2 HARI KE DEPAN ---
    const dailyForecasts = groupForecastByDay(cuacaData);
    let threeDayForecastHTML = '';
    const initialDelay = 800; 

    dailyForecasts.forEach((day, index) => {
        // Untuk icon 2 hari ke depan, prioritaskan data siang/pagi, atau fallback ke data yang dipilih tadi
        const mainForecast = day.morning || day.afternoon || day.evening || finalData;
        const dayIconURL = BMKG_ICON_MAP[String(mainForecast.weather)] || BMKG_ICON_MAP['default'];
        const delayClass = `animation-delay-${initialDelay + (index * 200)}`;

        threeDayForecastHTML += `
            <div class="p-4 bg-white rounded-xl shadow-md flex flex-col items-center hover:bg-[#F0F8F8] transition duration-200 animated-item ${delayClass}"
                 style="box-shadow: rgba(0, 0, 0, 0.2) 0px -4px 0px inset;">
                 <p class="font-semibold text-[#2C2C2C] text-lg mb-1">${formatDate(day.date)}</p>
                <div class="w-20 h-20 flex items-center justify-center mb-2">
                    <div class="w-32 h-32">
                        <img src="${dayIconURL}" alt="${mainForecast.weather_desc}" class="w-full h-full object-cover drop-shadow-xl">
                    </div>
                </div>
                <p class="text-sm text-[#666666] text-center mb-2">${mainForecast.weather_desc}</p>
                <p class="text-xl font-extrabold text-[#2B8A9E]">${day.minTemp}° / ${day.maxTemp}°</p>
            </div>
        `;
    });

    const locationName = `${lokasi.desa}, ${lokasi.kecamatan}, ${lokasi.kotkab}`;
    const weatherIconURL = BMKG_ICON_MAP[currentWeatherCode] || BMKG_ICON_MAP['default'];

    appContent.innerHTML = `
        <section id="detail-view" class="pt-24 pb-32 text-center">
            <a href="#" id="back-to-search-btn" class="inline-flex items-center text-[#2B8A9E] font-medium mb-10 hover:underline transition duration-200">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                Kembali ke Pencarian
            </a>

            <div class="bg-white rounded-[24px] shadow-2xl p-8 lg:p-12 mx-auto max-w-5xl animated-item animation-delay-100 mb-12" 
                style="box-shadow: rgba(0, 0, 0, 0.2) 0px -4px 0px inset;"> 
                <div class="flex flex-col md:flex-row justify-between items-center text-left">
                    <div>
                        <p class="text-xl font-medium text-[#666666]">${locationName}</p>
                        <h2 class="h2-zen">${descriptionText}</h2>
                        
                        <div class="flex items-start mt-4">
                            <span class="text-9xl font-black leading-none text-black" id="temperature">${currentTemp}</span>
                            <span class="text-6xl font-black mt-4 ml-1">°C</span>
                        </div>
                        
                        <p class="body-lg-zen mt-2 text-[#2C2C2C]">Waktu Data: <span class="font-bold">${timeDisplay} WIB</span></p>
                    </div>
                    <div class="text-right mt-6 md:mt-0">
                        <div class="w-96 h-96 mx-auto md:mx-0">
                            <img src="${weatherIconURL}" alt="${descriptionText}" class="w-full h-full object-cover drop-shadow-xl">
                        </div>
                    </div>
                </div>

                <div class="mt-12 pt-8 border-t border-gray-200 grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
                    <div class="p-4 bg-[#F0F8F8] rounded-xl" style="box-shadow: none;"> 
                        <p class="text-sm text-[#666666]">Kelembapan</p>
                        <p class="text-2xl font-extrabold text-[#2B8A9E]">${currentHumidity}%</p>
                    </div>
                    <div class="p-4 bg-[#F0F8F8] rounded-xl" style="box-shadow: none;"> 
                        <p class="text-sm text-[#666666]">Angin</p>
                        <p class="text-2xl font-extrabold text-[#2B8A9E]">${currentWindSpeed.toFixed(1)} km/j</p>
                    </div>
                    <div class="p-4 bg-[#F0F8F8] rounded-xl" style="box-shadow: none;"> 
                        <p class="text-sm text-[#666666]">Terendah/Tertinggi</p>
                        <p class="text-2xl font-extrabold text-[#2B8A9E]">${tempMin}° / ${tempMax}°</p>
                    </div>
                </div>
            </div>

            <div class="mx-auto max-w-5xl text-left">
                <h3 class="text-3xl font-bold text-black mb-6 animated-item animation-delay-600">Prakiraan 2 Hari Ke Depan</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${threeDayForecastHTML}
                </div>
                <p class="text-xs text-gray-500 mt-6 text-right animated-item animation-delay-${initialDelay + (dailyForecasts.length * 200)}">Data diambil dari BMKG, prakiraan dapat berubah sewaktu-waktu.</p>
            </div>
        </section>
    `;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveNavLink('');
    
    document.getElementById('back-to-search-btn').addEventListener('click', function(e) {
        e.preventDefault();
        history.replaceState(null, null, window.location.pathname);
        router(); 
    });
}


// --- API FETCH LOGIC (BMKG) ---

async function fetchWeatherData(adm4Code, villageName) {
    // Show loader and disable button
    appContent.innerHTML = loaderHTML;

    try {
        // Gunakan parameter 'adm4' untuk kode Desa/Kelurahan
        const url = `${BMKG_BASE_URL}?adm4=${adm4Code}`; 
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Gagal mengambil data cuaca BMKG: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Cek struktur respons BMKG yang benar: harus punya key 'lokasi' dan 'data' (array)
        if (!data || !data.lokasi || !data.data || data.data.length === 0) { 
            throw new Error(`Data cuaca tidak tersedia untuk kode wilayah ${adm4Code} (${villageName}).`);
        }
        
        // Success: Update URL hash and trigger router
        // Simpan kode dan nama di hash. Router akan mengambil data lagi dari hash.
        window.location.hash = `details?code=${encodeURIComponent(adm4Code)}&name=${encodeURIComponent(villageName)}`;
        
    } catch (error) {
        console.error("Fetch Error:", error.message);
        // 1. Re-render home page
        renderHomePage();
        
        // 2. Show error as notification
        showNotification(error.message);
        
        // 3. Reset background
        updateAppBackground(null);
    }
}


// --- ROUTER & INITIALIZATION ---

/**
 * Main router to handle view changes based on URL hash.
 */
function router() {
    const { page, params } = parseHash();

    // 1. JIKA HALAMAN DETAIL (Cuaca)
    if (page === 'details' && params.code && params.name) {
        appContent.innerHTML = loaderHTML;
        
        setNavToBackToSearch(true);
        const adm4Code = params.code;
        const villageName = params.name;
        const url = `${BMKG_BASE_URL}?adm4=${adm4Code}`;

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error("Gagal memuat data detail.");
                return res.json();
            })
            .then(data => {
                if (!data || !data.lokasi || !data.data || data.data.length === 0 || !data.data[0].cuaca) { 
                    throw new Error("Data cuaca tidak tersedia.");
                }
                renderDetailPage(villageName, data); 
            })
            .catch(error => {
                console.error("Detail Fetch Error:", error);
                showNotification("Gagal memuat detail cuaca. Silakan coba cari lagi.");
                // Hapus hash jika error agar kembali bersih
                history.replaceState(null, null, window.location.pathname);
                setNavToBackToSearch(false);
                
                // Reset background jika terjadi error
                updateAppBackground(null); 

                renderHomePage();
            });

    } else {
        // 2. JIKA HALAMAN UTAMA (Home, Contact, Feature)
        
        // --- PERBAIKAN: Pastikan URL bersih saat render home ---
        if (window.location.hash) {
            // Hapus hash dari address bar untuk membersihkan URL
            history.replaceState(null, null, window.location.pathname);
        }
        // --- AKHIR PERBAIKAN ---

        // Render halaman home
        setNavToBackToSearch(false);
        
        // Reset background ke warna default/home
        updateAppBackground(null);
        
        renderHomePage();
        
        // Set Home sebagai aktif setelah render selesai
        setTimeout(() => {
            updateActiveNavOnScroll();
        }, 100);
    }
}
// Listen for hash changes (back button, link clicks)
window.addEventListener('hashchange', router);

// --- IMPROVED SCROLL SPY IMPLEMENTATION ---

let scrollObserver = null;

/**
 * Fungsi untuk mendeteksi section mana yang sedang terlihat
 */
function updateActiveNavOnScroll() {
    const currentHash = window.location.hash;
    
    // Jangan jalankan scroll spy jika di halaman detail
    if (currentHash.startsWith('#details?')) {
        setActiveNavLink('');
        return;
    }
    
    // Cari section yang paling banyak terlihat di viewport
    let maxVisibleSection = null;
    let maxVisibleRatio = 0;
    
    sections.forEach(section => {
        const element = document.getElementById(section.id);
        if (!element) return;
        
        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        
        // Hitung berapa banyak section yang terlihat
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(windowHeight, rect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        
        // Hitung rasio visibility (0-1)
        const visibleRatio = visibleHeight / windowHeight;
        
        // Update jika ini section paling terlihat
        if (visibleRatio > maxVisibleRatio) {
            maxVisibleRatio = visibleRatio;
            maxVisibleSection = section.id;
        }
    });
    
    // Set active link berdasarkan section yang paling terlihat
    if (maxVisibleSection) {
        setActiveNavLink(maxVisibleSection);
    }
}

/**
 * Initialize Scroll Spy dengan Intersection Observer yang lebih akurat
 */
function initScrollSpy() {
    // Hapus observer lama jika ada
    if (scrollObserver) {
        scrollObserver.disconnect();
    }
    
    // Gunakan throttled scroll event untuk performa lebih baik
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(updateActiveNavOnScroll, 50);
    }, { passive: true });
    
    // Panggil sekali untuk set initial state
    updateActiveNavOnScroll();
}

// ——— FAQ TOGGLE ———
// Menggunakan event delegation di DOMContentLoaded untuk FAQ (memastikan elemen ada)
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Router Call
    router();

    // 2. Smooth Scroll Logic
    document.querySelectorAll('.smooth-scroll').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                const headerHeight = document.getElementById('zen-navbar').offsetHeight + 20; 
                const targetPosition = targetElement.offsetTop - headerHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // 3. Initialize Scroll Spy
    initScrollSpy();
    
    // 4. FAQ Toggle
    document.querySelectorAll('.faq-card').forEach(card => {
        const button = card.querySelector('.faq-toggle');
        const contentWrapper = card.querySelector('.faq-content');
        const plus = card.querySelector('.plus');
        const minus = card.querySelector('.minus');
        
        if (button) {
            button.addEventListener('click', () => {
                const isOpen = button.getAttribute('aria-expanded') === 'true';

                // Tutup semua yang lain (jika hanya ingin satu terbuka)
                document.querySelectorAll('.faq-toggle[aria-expanded="true"]').forEach(otherButton => {
                    if (otherButton !== button) {
                        otherButton.setAttribute('aria-expanded', 'false');
                        otherButton.closest('.faq-card').querySelector('.faq-content').style.maxHeight = '0px';
                        otherButton.querySelector('.plus').classList.remove('opacity-0');
                        otherButton.querySelector('.minus').classList.add('opacity-0');
                    }
                });

                // Toggle yang diklik
                if (isOpen) {
                    contentWrapper.style.maxHeight = '0px';
                    plus.classList.remove('opacity-0');
                    minus.classList.add('opacity-0');
                    button.setAttribute('aria-expanded', 'false');
                } else {
                    contentWrapper.style.maxHeight = contentWrapper.scrollHeight + 'px';
                    plus.classList.add('opacity-0');
                    minus.classList.remove('opacity-0');
                    button.setAttribute('aria-expanded', 'true');
                }
            });
        }
    });

    // --- NEW CTA FOOTER HANDLERS ---
    const bookCallBtn = document.getElementById('book-call-btn');
    const sendEmailBtn = document.getElementById('send-email-btn');
    const emailBtnText = document.getElementById('email-btn-text');
    const EMAIL_ADDRESS = "danielkristian44@gmail.com";
    let isCopying = false;

    // 1. Handle "Book a call" button click (Show "Coming Soon" notification)
    if (bookCallBtn) {
        bookCallBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // showNotification adalah fungsi yang diasumsikan sudah ada untuk menampilkan pesan.
            showNotification("Coming Soon! Fitur pemesanan panggilan sedang dikembangkan.");
        });
    }

    // 2. Handle "Send an email" button click (Copy to Clipboard with smooth text transition)
    if (sendEmailBtn) {
        sendEmailBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            if (isCopying) return; // Mencegah double click
            isCopying = true;
            
            try {
                // Salin ke clipboard
                await navigator.clipboard.writeText(EMAIL_ADDRESS);
                
                // Simpan teks asli
                const originalText = emailBtnText.textContent;
                
                // Kunci lebar tombol agar tidak bergeser saat teks berubah
                // Tambahkan transisi untuk efek smooth, meskipun pergantian teksnya instan
                sendEmailBtn.style.transition = 'all 0.3s ease';
                sendEmailBtn.style.minWidth = sendEmailBtn.offsetWidth + 'px'; 
                
                // Ganti teks
                emailBtnText.textContent = "Copied To Clip";
                
                // Tunda 2 detik, lalu kembalikan teks asli
                setTimeout(() => {
                    emailBtnText.textContent = originalText;
                    sendEmailBtn.style.minWidth = ''; // Hapus kunci lebar
                    isCopying = false;
                }, 2000);
                

            } catch (err) {
                console.error('Gagal menyalin:', err);
                isCopying = false;
                // Asumsi showNotification menangani tipe pesan
                showNotification('Gagal menyalin email. Browser Anda tidak mendukung fitur ini atau izin ditolak.');
            }
        });
    }
});