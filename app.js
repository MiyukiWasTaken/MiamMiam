// ============================================================
// Base de test — stockage en localStorage (simple, suffisant
// pour commencer). Si tu veux passer à IndexedDB plus tard
// pour plus de volume/robustesse, la logique de data ci-dessous
// est isolée exprès pour être facile à remplacer.
// ============================================================

const DB_KEY = "repas-app-data";

function loadData() {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) return JSON.parse(raw);
  return {
    plats: [],   // { id, nom, photo }
    items: [],   // { id, nom, categorie, photo }
    liaisons: [] // { id, aId, bId }  -> relie deux items OU deux plats entre eux
  };
}

function saveData(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

let data = loadData();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}

function readPhoto(fileInput) {
  const file = fileInput.files[0];
  if (!file) return Promise.resolve("");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
// Navigation entre les vues
// ============================================================

const views = {
  plats: document.getElementById("view-plats"),
  items: document.getElementById("view-items"),
  course: document.getElementById("view-course"),
  detail: document.getElementById("view-detail"),
};

function showView(name) {
  Object.values(views).forEach(v => v.classList.remove("active"));
  views[name].classList.add("active");

  document.getElementById("btn-ajouter").classList.toggle("visible", name === "plats" || name === "items");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

document.getElementById("btn-retour").addEventListener("click", () => {
  showView(currentDetailType === "plat" ? "plats" : "items");
});

// ============================================================
// Rendu des listes
// ============================================================

function renderPlats() {
  const ul = document.getElementById("liste-plats");
  ul.innerHTML = "";
  data.plats.forEach(plat => {
    const li = document.createElement("li");
    if (plat.photo) li.style.setProperty("--card-image", `url("${plat.photo}")`);
    li.innerHTML = `<span class="card-title">${plat.nom}</span><button class="btn-suppr" data-id="${plat.id}" aria-label="Supprimer ${plat.nom}">✕</button>`;
    li.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-suppr")) return;
      openDetail("plat", plat.id);
    });
    li.querySelector(".btn-suppr").addEventListener("click", () => {
      data.plats = data.plats.filter(p => p.id !== plat.id);
      data.liaisons = data.liaisons.filter(l => l.aId !== plat.id && l.bId !== plat.id);
      saveData(data);
      renderPlats();
    });
    ul.appendChild(li);
  });
}

function renderItems() {
  const ul = document.getElementById("liste-items");
  ul.innerHTML = "";
  data.items.forEach(item => {
    const li = document.createElement("li");
    if (item.photo) li.style.setProperty("--card-image", `url("${item.photo}")`);
    li.innerHTML = `<span class="card-title">${item.nom}</span><span class="badge">${item.categorie}</span><button class="btn-suppr" data-id="${item.id}" aria-label="Supprimer ${item.nom}">✕</button>`;
    li.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-suppr")) return;
      openDetail("item", item.id);
    });
    li.querySelector(".btn-suppr").addEventListener("click", () => {
      data.items = data.items.filter(i => i.id !== item.id);
      data.liaisons = data.liaisons.filter(l => l.aId !== item.id && l.bId !== item.id);
      saveData(data);
      renderItems();
    });
    ul.appendChild(li);
  });
}

// ============================================================
// Fenêtre d'ajout
// ============================================================

let currentAddType = "plat";
const dialogAjout = document.getElementById("dialog-ajout");
const formAjout = document.getElementById("form-ajout");
const nomAjoutInput = document.getElementById("input-ajout-nom");
const categorieAjoutInput = document.getElementById("input-ajout-categorie");
const photoAjoutInput = document.getElementById("input-ajout-photo");

document.getElementById("btn-ajouter").addEventListener("click", () => {
  currentAddType = document.getElementById("view-items").classList.contains("active") ? "item" : "plat";
  const isItem = currentAddType === "item";
  document.getElementById("dialog-ajout-titre").textContent = isItem ? "Ajouter un aliment" : "Ajouter un plat";
  nomAjoutInput.placeholder = isItem ? "Nom de l'aliment (ex: Pâtes)" : "Nom du plat (ex: Poulet riz)";
  categorieAjoutInput.hidden = !isItem;
  dialogAjout.showModal();
  nomAjoutInput.focus();
});

document.getElementById("btn-fermer-dialog").addEventListener("click", () => {
  dialogAjout.close();
});

formAjout.addEventListener("submit", async (e) => {
  e.preventDefault();
  const photo = await readPhoto(photoAjoutInput);
  if (currentAddType === "plat") {
    data.plats.push({ id: uid(), nom: nomAjoutInput.value.trim(), photo });
    renderPlats();
  } else {
    data.items.push({ id: uid(), nom: nomAjoutInput.value.trim(), categorie: categorieAjoutInput.value, photo });
    renderItems();
  }
  saveData(data);
  formAjout.reset();
  dialogAjout.close();
});

// ============================================================
// Vue détail : voir un plat/aliment + gérer ses liaisons
// ============================================================

let currentDetailType = null;
let currentDetailId = null;
let detailEditMode = false;
let editingNote = 0;

function openDetail(type, id) {
  currentDetailType = type;
  currentDetailId = id;

  const collection = type === "plat" ? data.plats : data.items;
  const elem = collection.find(x => x.id === id);

  document.getElementById("detail-titre").textContent = elem.nom;
  document.getElementById("btn-modifier").textContent = "Modifier";
  detailEditMode = false;
  editingNote = elem.note || 0;
  renderDetailContenu();
  showView("detail");
}

function renderDetailContenu() {
  const collection = currentDetailType === "plat" ? data.plats : data.items;
  const elem = collection.find(x => x.id === currentDetailId);
  const autresMemeType = collection.filter(x => x.id !== currentDetailId);

  if (detailEditMode) {
    renderDetailEdition(elem);
    return;
  }

  const liaisonsExistantes = data.liaisons.filter(
    l => l.aId === currentDetailId || l.bId === currentDetailId
  );

  const html = `
    <div class="detail-infos">
      ${elem.photo ? '<div id="detail-photo" class="detail-photo" role="img" aria-label="Photo de ' + escapeHtml(elem.nom) + '"></div>' : ""}
      <div class="detail-field">
        <h3>Description</h3>
        <p>${escapeHtml(elem.description || "Aucune description pour le moment.")}</p>
      </div>
      <div class="detail-field">
        <h3>Recette</h3>
        ${elem.recette ? `<ul class="recipe-list">${formatRecipe(elem.recette)}</ul>` : '<p class="detail-recipe">Aucune recette pour le moment.</p>'}
      </div>
      <div class="detail-field">
        <h3>Note</h3>
        <div class="rating" aria-label="Note : ${elem.note || 0} sur 5">${renderStars(elem.note || 0)}</div>
      </div>
    </div>
    <div class="liaisons">
      <strong>Éléments liés :</strong>
      <ul class="liste">
        ${liaisonsExistantes.map(l => {
          const autreId = l.aId === currentDetailId ? l.bId : l.aId;
          const autre = collection.find(x => x.id === autreId);
          if (!autre) return "";
          return `<li>${autre.nom} <button class="btn-suppr" data-liaison="${l.id}">✕</button></li>`;
        }).join("")}
      </ul>

      <div class="liaison-form">
        <select id="select-liaison">
          ${autresMemeType.map(x => `<option value="${x.id}">${x.nom}</option>`).join("")}
        </select>
        <button id="btn-ajouter-liaison">Lier</button>
      </div>
    </div>
  `;

  document.getElementById("detail-contenu").innerHTML = html;
  if (elem.photo) {
    document.getElementById("detail-photo").style.backgroundImage = `url("${elem.photo}")`;
  }

  document.querySelectorAll("[data-liaison]").forEach(btn => {
    btn.addEventListener("click", () => {
      data.liaisons = data.liaisons.filter(l => l.id !== btn.dataset.liaison);
      saveData(data);
      renderDetailContenu();
    });
  });

  const btnAjouter = document.getElementById("btn-ajouter-liaison");
  if (btnAjouter) {
    btnAjouter.addEventListener("click", () => {
      const autreId = document.getElementById("select-liaison").value;
      if (!autreId) return;
      data.liaisons.push({ id: uid(), aId: currentDetailId, bId: autreId });
      saveData(data);
      renderDetailContenu();
    });
  }
}

function renderStars(note) {
  return Array.from({ length: 5 }, (_, index) => {
    const value = index + 1;
    const state = note >= value ? "full" : note >= value - 0.5 ? "half" : "empty";
    return `<span class="star ${state}" aria-hidden="true">★</span>`;
  }).join("");
}

function renderEditableStars(note) {
  return Array.from({ length: 5 }, (_, index) => {
    const leftValue = index + 0.5;
    const rightValue = index + 1;
    const state = note >= rightValue ? "full" : note >= leftValue ? "half" : "empty";
    return `<span class="star-choice">
      <span class="editable-star ${state}" aria-hidden="true">★</span>
      <button type="button" class="star-half" data-note="${leftValue}" aria-label="${leftValue} étoile"></button>
      <button type="button" class="star-half" data-note="${rightValue}" aria-label="${rightValue} étoile${rightValue > 1 ? "s" : ""}"></button>
    </span>`;
  }).join("");
}

function formatRecipe(recipe) {
  return recipe.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const cleanLine = line.replace(/^[-*•]\s*/, "");
    return `<li>${escapeHtml(cleanLine)}</li>`;
  }).join("");
}

function renderDetailEdition(elem) {
  const isItem = currentDetailType === "item";
  document.getElementById("detail-titre").textContent = "Modifier";
  document.getElementById("detail-contenu").innerHTML = `
    <form id="form-detail-edition" class="detail-edit-form">
      <div class="edit-name-row">
        <input type="text" id="edit-nom" value="${escapeHtml(elem.nom)}" required aria-label="Nom">
        <label class="photo-input edit-photo-button">
          <span>Photo</span>
          <input type="file" id="edit-photo" accept="image/*">
        </label>
      </div>
      ${isItem ? `<select id="edit-categorie" aria-label="Catégorie">
        <option value="viande" ${elem.categorie === "viande" ? "selected" : ""}>Viande</option>
        <option value="feculent" ${elem.categorie === "feculent" ? "selected" : ""}>Féculent</option>
        <option value="fruit" ${elem.categorie === "fruit" ? "selected" : ""}>Fruit</option>
        <option value="legume" ${elem.categorie === "legume" ? "selected" : ""}>Légume</option>
      </select>` : ""}
      <label>Description<textarea id="edit-description" rows="3">${escapeHtml(elem.description || "")}</textarea></label>
      <label>Recette<textarea id="edit-recette" rows="6">${escapeHtml(elem.recette || "")}</textarea></label>
      <fieldset class="edit-rating">
        <legend>Note</legend>
        <div class="rating rating-edit" role="radiogroup" aria-label="Choisir une note">
          ${renderEditableStars(editingNote)}
        </div>
      </fieldset>
      <div class="edit-actions">
        <button id="btn-annuler-edition" type="button">Annuler</button>
        <button type="submit">Enregistrer</button>
      </div>
    </form>
  `;

  document.querySelectorAll(".star-half").forEach(button => {
    button.addEventListener("click", () => {
      editingNote = Number(button.dataset.note);
      document.querySelectorAll(".star-choice").forEach((choice, index) => {
        const leftValue = index + 0.5;
        const rightValue = index + 1;
        const state = editingNote >= rightValue ? "full" : editingNote >= leftValue ? "half" : "empty";
        const star = choice.querySelector(".editable-star");
        star.classList.remove("full", "half", "empty");
        star.classList.add(state);
      });
    });
  });

  document.getElementById("btn-annuler-edition").addEventListener("click", () => {
    detailEditMode = false;
    const current = (currentDetailType === "plat" ? data.plats : data.items).find(x => x.id === currentDetailId);
    editingNote = current.note || 0;
    document.getElementById("detail-titre").textContent = current.nom;
    document.getElementById("btn-modifier").textContent = "Modifier";
    renderDetailContenu();
  });

  document.getElementById("form-detail-edition").addEventListener("submit", async event => {
    event.preventDefault();
    const photoInput = document.getElementById("edit-photo");
    const newPhoto = photoInput.files[0] ? await readPhoto(photoInput) : elem.photo || "";
    elem.nom = document.getElementById("edit-nom").value.trim();
    elem.description = document.getElementById("edit-description").value.trim();
    elem.recette = document.getElementById("edit-recette").value.trim();
    elem.note = editingNote;
    elem.photo = newPhoto;
    if (isItem) elem.categorie = document.getElementById("edit-categorie").value;
    saveData(data);
    detailEditMode = false;
    document.getElementById("detail-titre").textContent = elem.nom;
    document.getElementById("btn-modifier").textContent = "Modifier";
    renderDetailContenu();
    renderPlats();
    renderItems();
  });
}

document.getElementById("btn-modifier").addEventListener("click", () => {
  detailEditMode = !detailEditMode;
  const collection = currentDetailType === "plat" ? data.plats : data.items;
  const elem = collection.find(x => x.id === currentDetailId);
  editingNote = elem.note || 0;
  document.getElementById("btn-modifier").textContent = detailEditMode ? "Annuler" : "Modifier";
  if (!detailEditMode) document.getElementById("detail-titre").textContent = elem.nom;
  renderDetailContenu();
});

// ============================================================
// Enregistrement du service worker (fonctionnement hors-ligne)
// ============================================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(err => {
      console.log("Erreur service worker :", err);
    });
  });
}

// ============================================================
// Rendu initial
// ============================================================

renderPlats();
renderItems();
