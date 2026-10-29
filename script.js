const STORAGE_KEY = "biosiswa_task_full_prototype_v1";

const INITIAL_DATA = {
    points: 0,
    missions: [
        {
            id: "mission-1",
            title: "Pilah Sampah dengan Benar",
            description: "Pisahkan sampah sesuai jenisnya mengikuti petunjuk tempat sampah sekolah.",
            points: 40,
            active: true
        },
        {
            id: "mission-2",
            title: "Bersihkan Area Kelas",
            description: "Bekerja sama menjaga area kelas tetap bersih setelah kegiatan belajar.",
            points: 30,
            active: true
        },
        {
            id: "mission-3",
            title: "Rawat Tanaman Sekolah",
            description: "Rawat tanaman sesuai arahan guru dan dokumentasikan kegiatan.",
            points: 35,
            active: true
        },
        {
            id: "mission-4",
            title: "Kumpulkan Sampah Elektronik dengan Aman",
            description: "Serahkan barang elektronik bekas ke titik pengumpulan dengan pengawasan guru. Jangan membongkar perangkat.",
            points: 100,
            active: true
        }
    ],
    submissions: [],
    redemptions: []
};

const PRODUCTS = [
    { id: "product-1", name: "Pulpen", description: "Alat tulis untuk kegiatan belajar.", points: 100 },
    { id: "product-2", name: "Buku catatan", description: "Buku catatan untuk tugas sekolah.", points: 250 },
    { id: "product-3", name: "Pensil", description: "Pensil untuk kegiatan kelas.", points: 80 }
];

let appData = loadData();
let compressedPhoto = "";

function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
}

function loadData() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        return savedData ? { ...cloneData(INITIAL_DATA), ...JSON.parse(savedData) } : cloneData(INITIAL_DATA);
    } catch (error) {
        return cloneData(INITIAL_DATA);
    }
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        renderPage();
    } catch (error) {
        showToast("Penyimpanan browser penuh. Hapus beberapa bukti demo atau gunakan foto yang lebih kecil.");
    }
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[character]));
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove("hidden");

    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        toast.classList.add("hidden");
    }, 3500);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function getMission(missionId) {
    return appData.missions.find(mission => mission.id === missionId);
}

function getStatusText(status) {
    if (status === "approved") return "Diterima";
    if (status === "rejected") return "Ditolak";
    return "Menunggu";
}

function getStatusClass(status) {
    if (status === "approved") return "status status-approved";
    if (status === "rejected") return "status status-rejected";
    return "status";
}

function missionCard(mission) {
    return `
        <article class="mission-card">
            <span class="card-label">Misi aktif</span>
            <h3>${escapeHTML(mission.title)}</h3>
            <p>${escapeHTML(mission.description)}</p>
            <div class="card-footer">
                <span class="point-value">+${mission.points} poin</span>
                <a class="button button-primary" href="siswa.html?misi=${encodeURIComponent(mission.id)}">Kerjakan</a>
            </div>
        </article>
    `;
}

function renderHome() {
    const points = document.getElementById("home-points");
    if (!points) return;

    points.textContent = appData.points;
    document.getElementById("home-submissions").textContent = appData.submissions.length;
    document.getElementById("home-approved").textContent = appData.submissions.filter(item => item.status === "approved").length;
    document.getElementById("home-missions").textContent = appData.missions.filter(item => item.active).length;

    const activeMissions = appData.missions.filter(item => item.active).slice(0, 3);
    document.getElementById("home-mission-list").innerHTML = activeMissions.length
        ? activeMissions.map(missionCard).join("")
        : '<p class="empty-state">Belum ada misi aktif. Guru dapat menambahkan misi melalui panel guru.</p>';
}

function renderStudentMissions() {
    const missionList = document.getElementById("student-mission-list");
    if (!missionList) return;

    const activeMissions = appData.missions.filter(item => item.active);
    missionList.innerHTML = activeMissions.length
        ? activeMissions.map(missionCard).join("")
        : '<p class="empty-state">Belum ada misi aktif.</p>';

    const requestedMission = new URLSearchParams(window.location.search).get("misi");
    if (requestedMission && getMission(requestedMission)) {
        selectMission(requestedMission);
    }
}

function selectMission(missionId) {
    const mission = getMission(missionId);
    if (!mission || !mission.active) {
        showToast("Misi tidak tersedia.");
        return;
    }

    document.getElementById("selected-mission-id").value = mission.id;
    document.getElementById("selected-mission-label").textContent =
        `Misi dipilih: ${mission.title} · Hadiah ${mission.points} poin.`;
    document.getElementById("submission-form-section").scrollIntoView({ behavior: "smooth" });
}

function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Foto gagal dibaca."));
        reader.readAsDataURL(file);
    });
}

async function compressImage(file) {
    if (!file || !["image/jpeg", "image/png"].includes(file.type)) {
        throw new Error("Gunakan foto berformat JPG atau PNG.");
    }

    const maxSize = 500 * 1024;
    if (file.size <= maxSize) {
        return { data: await fileToDataURL(file), size: file.size };
    }

    if (!window.createImageBitmap) {
        throw new Error("Browser ini belum mendukung kompresi otomatis. Pilih foto di bawah 500 KB.");
    }

    const image = await createImageBitmap(file);
    let width = image.width;
    let height = image.height;
    const maxDimension = 1500;

    if (Math.max(width, height) > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);

    let quality = 0.82;
    let blob = null;

    for (let attempt = 0; attempt < 10; attempt++) {
        blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
        if (blob && blob.size <= maxSize) break;
        quality -= 0.07;
    }

    if (!blob || blob.size > maxSize) {
        throw new Error("Foto belum bisa diperkecil sampai 500 KB. Coba foto dengan ukuran awal lebih kecil.");
    }

    return { data: await fileToDataURL(blob), size: blob.size };
}

function setupSubmissionForm() {
    const form = document.getElementById("submission-form");
    if (!form) return;

    const photoInput = document.getElementById("proof-photo");
    const photoStatus = document.getElementById("photo-status");

    photoInput.addEventListener("change", async () => {
        compressedPhoto = "";
        const file = photoInput.files[0];

        if (!file) {
            photoStatus.textContent = "";
            return;
        }

        photoStatus.textContent = "Memeriksa dan mengompres foto...";

        try {
            const result = await compressImage(file);
            compressedPhoto = result.data;
            photoStatus.textContent = `Foto siap · ${(result.size / 1024).toFixed(0)} KB`;
        } catch (error) {
            photoInput.value = "";
            photoStatus.textContent = error.message;
            showToast(error.message);
        }
    });

    form.addEventListener("reset", () => {
        compressedPhoto = "";
        photoStatus.textContent = "";
        document.getElementById("selected-mission-id").value = "";
        document.getElementById("selected-mission-label").textContent = "Pilih tombol Kerjakan pada salah satu misi.";
    });

    form.addEventListener("submit", event => {
        event.preventDefault();

        const missionId = document.getElementById("selected-mission-id").value;
        const mission = getMission(missionId);

        if (!mission || !mission.active) {
            showToast("Pilih misi yang masih aktif terlebih dahulu.");
            return;
        }

        if (!compressedPhoto) {
            showToast("Pilih foto bukti yang valid terlebih dahulu.");
            return;
        }

        const submission = {
            id: `submission-${Date.now()}`,
            missionId: mission.id,
            missionTitle: mission.title,
            points: mission.points,
            studentName: document.getElementById("student-name").value.trim(),
            studentClass: document.getElementById("student-class").value,
            notes: document.getElementById("proof-notes").value.trim(),
            photo: compressedPhoto,
            status: "pending",
            reason: "",
            createdAt: new Date().toISOString()
        };

        appData.submissions.unshift(submission);
        compressedPhoto = "";
        saveData();
        form.reset();
        showToast("Bukti demo berhasil dikirim untuk diperiksa.");
        renderStudentActivity();
    });
}

function renderStudentActivity() {
    const list = document.getElementById("student-activity-list");
    if (!list) return;

    if (!appData.submissions.length) {
        list.innerHTML = '<p class="empty-state">Belum ada bukti yang dikirim dari browser ini.</p>';
        return;
    }

    list.innerHTML = appData.submissions.map(submission => `
        <article class="activity-item">
            <div>
                <h3>${escapeHTML(submission.missionTitle)}</h3>
                <p>${escapeHTML(submission.studentName)} · ${escapeHTML(submission.studentClass)} · ${formatDate(submission.createdAt)}</p>
                <p>${escapeHTML(submission.notes)}</p>
                ${submission.reason ? `<p>Catatan guru: ${escapeHTML(submission.reason)}</p>` : ""}
            </div>
            <span class="${getStatusClass(submission.status)}">${getStatusText(submission.status)}</span>
        </article>
    `).join("");
}

function setupMissionForm() {
    const form = document.getElementById("mission-form");
    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const title = document.getElementById("mission-title").value.trim();
        const description = document.getElementById("mission-description").value.trim();
        const points = Number(document.getElementById("mission-points").value);

        if (!title || !description || !Number.isInteger(points) || points < 1 || points > 1000) {
            showToast("Periksa kembali judul, deskripsi, dan poin misi.");
            return;
        }

        appData.missions.unshift({
            id: `mission-${Date.now()}`,
            title,
            description,
            points,
            active: true
        });

        form.reset();
        document.getElementById("mission-points").value = 30;
        saveData();
        showToast("Misi ditambahkan ke data demo.");
    });
}

function renderPendingSubmissions() {
    const list = document.getElementById("pending-submissions");
    if (!list) return;

    const pending = appData.submissions.filter(submission => submission.status === "pending");

    if (!pending.length) {
        list.innerHTML = '<p class="empty-state">Tidak ada bukti yang menunggu pemeriksaan.</p>';
        return;
    }

    list.innerHTML = pending.map(submission => `
        <article class="review-item">
            <div class="review-content">
                <h3>${escapeHTML(submission.missionTitle)}</h3>
                <p>${escapeHTML(submission.studentName)} · ${escapeHTML(submission.studentClass)} · ${formatDate(submission.createdAt)}</p>
                <p>${escapeHTML(submission.notes)}</p>
                <p>Hadiah jika diterima: ${submission.points} poin</p>
                <img class="proof-image" src="${submission.photo}" alt="Foto bukti tugas siswa">
            </div>
            <div class="review-actions">
                <button class="button button-primary" type="button" data-approve="${submission.id}">Terima</button>
                <button class="button button-danger" type="button" data-reject="${submission.id}">Tolak</button>
            </div>
        </article>
    `).join("");

    list.querySelectorAll("[data-approve]").forEach(button => {
        button.addEventListener("click", () => reviewSubmission(button.dataset.approve, "approved"));
    });

    list.querySelectorAll("[data-reject]").forEach(button => {
        button.addEventListener("click", () => {
            const reason = window.prompt("Tuliskan alasan penolakan:");
            if (reason === null) return;
            reviewSubmission(button.dataset.reject, "rejected", reason.trim() || "Bukti belum sesuai.");
        });
    });
}

function reviewSubmission(submissionId, status, reason = "") {
    const submission = appData.submissions.find(item => item.id === submissionId && item.status === "pending");
    if (!submission) return;

    submission.status = status;
    submission.reason = reason;

    if (status === "approved") {
        appData.points += submission.points;
    }

    saveData();
    showToast(status === "approved" ? "Bukti diterima. Poin demo ditambahkan." : "Bukti ditolak.");
}

function renderManageMissions() {
    const list = document.getElementById("manage-missions");
    if (!list) return;

    list.innerHTML = appData.missions.map(mission => `
        <article class="manage-item">
            <div>
                <h3>${escapeHTML(mission.title)}</h3>
                <p>${mission.points} poin · ${mission.active ? "Aktif" : "Nonaktif"}</p>
            </div>
            <button class="button button-secondary" type="button" data-toggle-mission="${mission.id}">
                ${mission.active ? "Nonaktifkan" : "Aktifkan"}
            </button>
        </article>
    `).join("");

    list.querySelectorAll("[data-toggle-mission]").forEach(button => {
        button.addEventListener("click", () => {
            const mission = getMission(button.dataset.toggleMission);
            if (!mission) return;
            mission.active = !mission.active;
            saveData();
            showToast(mission.active ? "Misi diaktifkan." : "Misi dinonaktifkan.");
        });
    });
}

function setupResetButton() {
    const button = document.getElementById("reset-demo");
    if (!button) return;

    button.addEventListener("click", () => {
        const confirmed = window.confirm("Reset semua data demo pada browser ini?");
        if (!confirmed) return;

        appData = cloneData(INITIAL_DATA);
        localStorage.removeItem(STORAGE_KEY);
        saveData();
        showToast("Data demo berhasil direset.");
    });
}

function renderShop() {
    const productList = document.getElementById("product-list");
    if (!productList) return;

    document.getElementById("shop-points").textContent = `${appData.points} poin`;

    productList.innerHTML = PRODUCTS.map(product => `
        <article class="product-card">
            <span class="card-label">Barang koperasi</span>
            <h3>${escapeHTML(product.name)}</h3>
            <p>${escapeHTML(product.description)}</p>
            <div class="card-footer">
                <span class="point-value">${product.points} poin</span>
                <button class="button button-primary" type="button" data-redeem="${product.id}" ${appData.points < product.points ? "disabled" : ""}>Tukar poin</button>
            </div>
        </article>
    `).join("");

    productList.querySelectorAll("[data-redeem]").forEach(button => {
        button.addEventListener("click", () => redeemProduct(button.dataset.redeem));
    });

    renderRedemptionHistory();
}

function redeemProduct(productId) {
    const product = PRODUCTS.find(item => item.id === productId);
    if (!product || appData.points < product.points) return;

    const confirmed = window.confirm(`Tukar ${product.points} poin untuk ${product.name}?`);
    if (!confirmed) return;

    appData.points -= product.points;
    appData.redemptions.unshift({
        id: `redemption-${Date.now()}`,
        productName: product.name,
        points: product.points,
        createdAt: new Date().toISOString()
    });

    saveData();
    showToast("Penukaran demo berhasil.");
}

function renderRedemptionHistory() {
    const list = document.getElementById("redemption-history");
    if (!list) return;

    if (!appData.redemptions.length) {
        list.innerHTML = '<p class="empty-state">Belum ada penukaran poin.</p>';
        return;
    }

    list.innerHTML = appData.redemptions.map(item => `
        <article class="redemption-item">
            <div>
                <strong>${escapeHTML(item.productName)}</strong>
                <p>${formatDate(item.createdAt)}</p>
            </div>
            <span class="point-value">-${item.points} poin</span>
        </article>
    `).join("");
}

function renderPage() {
    renderHome();
    renderStudentMissions();
    renderStudentActivity();
    renderPendingSubmissions();
    renderManageMissions();
    renderShop();
}

document.addEventListener("DOMContentLoaded", () => {
    setupSubmissionForm();
    setupMissionForm();
    setupResetButton();
    renderPage();
});