import "./directory-submit.css";
import { escapeHtml } from "./public-page";

type Directory = "menus" | "listings" | "community" | "festivals" | "events";
type Tracker = (event: string, parameters?: Record<string, string | number | boolean>) => void;

/** Shared verified-email intake across the sister sites; no account or automatic publication. */
export function directorySubmitMarkup(directory: Directory, header = "", footer = "", correction?: { name: string; slug: string }): string {
  const community = directory === "community";
  const festival = directory === "festivals";
  const event = directory === "events";
  const dated = festival || event;
  const label = { menus: "Menus", listings: "Listings", community: "Community", festivals: "Festivals", events: "Events" }[directory];
  const noun = event ? "event" : festival ? "festival" : community ? "organization" : directory === "menus" ? "restaurant" : "business";
  const profilePath = correction ? `/${{ menus: "restaurants", listings: "businesses", community: "organizations", festivals: "festivals", events: "events" }[directory]}/${encodeURIComponent(correction.slug)}/` : "/";
  const tag = dated ? "section" : "main";
  return `${header}<${tag} ${dated ? "" : 'id="main"'} class="directory-submit ${directory}">
    <a href="${profilePath}" class="submission-back">← Back to ${correction ? escapeHtml(correction.name) : label}</a>
    <div class="submission-intro"><p class="eyebrow">Help your neighbors find the good nearby</p>
    <h1>${correction ? "Suggest a correction." : event ? "Submit an event." : festival ? "Missing a festival?" : `Submit ${community ? "an organization" : "a business"}.`}</h1>
    <p>${correction ? `For <strong>${escapeHtml(correction.name)}</strong>. Tell us what needs updating and where we can verify it. Your suggestion goes to a private review queue; it won’t change the profile automatically.` : `Know a ${event ? "community event in Sabine Parish" : festival ? "festival or community celebration in Sabine Parish" : community ? "community group, nonprofit, ministry, or local service" : "local business"} we should include? Send us its details. We’ll check the information before anything goes live.`}</p></div>
    <section class="submission-card" aria-label="Submission form">
      <ol class="submission-steps" aria-label="Submission steps"><li data-stage="email" aria-current="step">1 · Email</li><li data-stage="code">2 · Verify</li><li data-stage="details">3 · Details</li></ol>
      <form method="post" data-email-form><h2>Start with your email.</h2><p>No password or account needed. We’ll email you a six-digit code.</p>
        <label>Email address<input name="email" type="email" autocomplete="email" maxlength="254" required placeholder="you@example.com"></label>
        <button type="submit">Email me a code →</button></form>
      <form method="post" data-code-form hidden><h2>Check your inbox.</h2><p>We sent a code to <strong data-email-label></strong>. It expires in 10 minutes. Check spam if it’s missing.</p>
        <label>Verification code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="000000"></label>
        <button type="submit">Verify email →</button><button type="button" class="secondary" data-restart>Request a new code / change email</button></form>
      <form method="post" data-details-form hidden><h2>${correction ? "What needs correcting?" : `Tell us about the ${noun}.`}</h2>
        <div class="submission-fields">
          ${correction ? `<p class="wide">Existing profile: <strong>${escapeHtml(correction.name)}</strong></p>
          <label class="wide">Your name <small>optional</small><input name="submitter_name" maxlength="120" autocomplete="name"></label>
          <label class="wide">Correction and source<textarea name="notes" maxlength="4000" rows="6" required placeholder="What is incorrect? Tell us the correct details and include an official source or how we can verify them. Do not include sensitive personal information."></textarea></label>` : `
          <label class="wide">${event ? "Event" : festival ? "Festival" : community ? "Organization" : "Business"} name<input name="name" maxlength="180" required></label>
          <label class="wide">Location or address<input name="location" maxlength="260" required placeholder="Street address, city, state"></label>
          ${dated ? `<label>Start date<input name="starts_on" type="date" required></label><label>End date <small>optional for a one-day event</small><input name="ends_on" type="date"></label>` : ""}
          ${event ? `<label class="wide">When does it happen?<select name="all_day"><option value="true">All day / no set time</option><option value="false">At a specific time</option></select></label>
          <div class="wide submission-fields" data-clock-fields hidden><label>Start time (Central)<input name="starts_at" type="time" disabled></label><label>End time (Central) <small>optional for one day</small><input name="ends_at" type="time" disabled></label></div>
          <label class="wide">Associated business or organization <small>optional</small><select data-profile-choice><option value="">No profile selected</option></select><small data-profile-note>Loading published profiles…</small></label><input name="association_kind" type="hidden"><input name="association_slug" type="hidden">
          <p class="wide">For a repeating event, enter one occurrence and describe the other dates in the notes. We review dates before publishing.</p>` : ""}
          <label>Your name <small>optional</small><input name="submitter_name" maxlength="120" autocomplete="name"></label>
          <label>${dated ? "Organizer" : community ? "Organization" : "Business"} phone <small>optional</small><input name="phone" type="tel" maxlength="32"></label>
          <label class="wide">Category or type <small>optional</small><input name="category" maxlength="120" placeholder="${dated ? "Food, music, heritage, holiday…" : community ? "Youth & Family, Food & Assistance, ministry…" : "Hair salon, pharmacy, repair shop…"}"></label>
          <label class="wide">Website or social page <small>optional</small><input name="website" type="text" inputmode="url" maxlength="500" autocapitalize="none" spellcheck="false" placeholder="example.com or facebook.com/your-page"></label>
          <label class="wide">${dated ? "What happens at the event?" : "What do they offer?"} <small>optional</small><textarea name="description" maxlength="2000" rows="3" placeholder="${dated ? "Activities, entertainment, and what visitors can expect" : community ? "Programs, services, and who the organization serves" : "Services, products, or specialties"}"></textarea></label>
          <label class="wide">${dated ? "Schedule, admission, and sources" : "Hours, sources, or other notes"} <small>optional</small><textarea name="notes" maxlength="4000" rows="4" placeholder="${dated ? "Share times, admission prices, and an official announcement or flyer link. List any details still to be announced." : "Share confirmed hours and where we can verify these details. A link to an official logo or photo is welcome."}"></textarea></label>`}
        </div><p class="submission-privacy">Your email is used to verify this submission and will not appear publicly. Please don’t include sensitive personal information in the notes.</p>
        <button type="submit">Send for review →</button><button type="button" class="secondary" data-reverify hidden>Verify email again</button>
      </form>
      <div class="submission-message" data-submission-message role="status" aria-live="polite" hidden></div>
      <section data-success hidden tabindex="-1"><h2>Thanks for helping your neighbors.</h2><p>${correction ? "Your correction is saved for review. The existing profile has not changed." : `Your ${noun} submission is saved for review. It isn’t published yet.`}</p><p>Reference: <strong data-reference></strong></p><a class="submission-cta" href="${profilePath}">Back to ${correction ? escapeHtml(correction.name) : label}</a></section>
    </section></${tag}>${footer}`;
}

export function renderDirectorySubmit(app: HTMLElement, directory: Directory, header: string, footer: string, track: Tracker, correction?: { name: string; slug: string }): void {
  app.innerHTML = directorySubmitMarkup(directory, header, footer, correction);
  const label = {menus:"Menus",listings:"Listings",community:"Community",festivals:"Festivals",events:"Events"}[directory];
  document.title = correction ? `Suggest a correction — ${correction.name} — ${label}` : directory === "events" ? "Submit an event — All Things Sabine" : directory === "festivals" ? "Missing a festival? — Festivals" : `Submit ${directory === "community" ? "an organization" : "a business"} — ${label}`;
  bindDirectorySubmit(app, directory, track, correction);
}

export function bindDirectorySubmit(app: HTMLElement, directory: Directory, track: Tracker, correction?: { name: string; slug: string }): void {
  const emailForm = app.querySelector<HTMLFormElement>("[data-email-form]")!;
  const codeForm = app.querySelector<HTMLFormElement>("[data-code-form]")!;
  const details = app.querySelector<HTMLFormElement>("[data-details-form]")!;
  const message = app.querySelector<HTMLElement>("[data-submission-message]")!;
  const reverify = app.querySelector<HTMLButtonElement>("[data-reverify]")!;
  if (directory === "events") {
    const allDay = details.querySelector<HTMLSelectElement>('[name="all_day"]')!;
    const clocks = details.querySelector<HTMLElement>('[data-clock-fields]')!;
    allDay.addEventListener("change", () => {
      const timed = allDay.value === "false";
      clocks.hidden = !timed;
      clocks.querySelectorAll<HTMLInputElement>("input").forEach(input => { input.disabled = !timed; });
      details.querySelector<HTMLInputElement>('[name="starts_at"]')!.required = timed;
    });
    const profiles = details.querySelector<HTMLSelectElement>('[data-profile-choice]')!;
    profiles.addEventListener("change", () => {
      const [kind = "", slug = ""] = profiles.value.split(":");
      details.querySelector<HTMLInputElement>('[name="association_kind"]')!.value = kind;
      details.querySelector<HTMLInputElement>('[name="association_slug"]')!.value = slug;
    });
    const note = details.querySelector<HTMLElement>('[data-profile-note]')!;
    void fetch("/api/calendar/profiles/", {signal: AbortSignal.timeout(15000)}).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      for (const profile of data.profiles) {
        const option = document.createElement("option");
        option.value = `${profile.kind}:${profile.slug}`;
        option.textContent = `${profile.name} (${profile.kind === "menus" ? "Restaurant" : profile.kind === "listings" ? "Business" : "Organization"})`;
        profiles.append(option);
      }
      note.textContent = "Choose an organizer or venue already in our directories.";
    }).catch(() => { note.textContent = "Profiles are unavailable right now. You can include an organizer or venue in the notes."; });
  }
  let email = "";
  let requestId = "";
  let token = "";
  let busy = false;
  function showMessage(text: string, error = false) {
    message.textContent = text;
    message.hidden = !text;
    message.dataset.error = String(error);
  }
  function step(stage: "email" | "code" | "details") {
    emailForm.hidden = stage !== "email";
    codeForm.hidden = stage !== "code";
    details.hidden = stage !== "details";
    app.querySelectorAll<HTMLElement>("[data-stage]").forEach((node) => {
      if (node.dataset.stage === stage) node.setAttribute("aria-current", "step");
      else node.removeAttribute("aria-current");
    });
    ({ email: emailForm, code: codeForm, details })[stage].querySelector<HTMLInputElement>("input")?.focus();
  }
  async function request(url: string, options: RequestInit) {
    let response: Response;
    try { response = await fetch(url, { ...options, signal: AbortSignal.timeout(60000) }); }
    catch { throw new Error("We couldn’t reach the server. Your details are still here—please try again."); }
    let payload: { error?: string; requestId?: string; token?: string; reference?: string };
    try { payload = await response.json(); }
    catch { throw new Error("The server couldn’t finish this request. Please try again."); }
    if (!response.ok) {
      if ((response.status === 401 || response.status === 409) && token) { token = ""; reverify.hidden = false; }
      throw new Error(payload.error || "Please try again.");
    }
    return payload;
  }
  async function run(form: HTMLFormElement, task: () => Promise<void>) {
    if (busy) return;
    busy = true;
    const buttons = [...form.querySelectorAll<HTMLButtonElement>("button")];
    buttons.forEach((button) => { button.disabled = true; });
    form.setAttribute("aria-busy", "true");
    showMessage("Working… This may take a moment while the server wakes up.");
    try { await task(); }
    catch (error) { showMessage(error instanceof Error ? error.message : "Please try again.", true); }
    finally { busy = false; form.removeAttribute("aria-busy"); buttons.forEach((button) => { button.disabled = false; }); }
  }
  emailForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void run(emailForm, async () => {
      email = String(new FormData(emailForm).get("email") || "").trim();
      const result = await request("/api/submissions/code/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, directory }) });
      if (!result.requestId) throw new Error("No code request was returned. Please try again.");
      requestId = result.requestId;
      app.querySelector<HTMLElement>("[data-email-label]")!.textContent = email;
      codeForm.reset(); step("code"); showMessage("");
      track("submission_code_requested", { directory });
    });
  });
  codeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void run(codeForm, async () => {
      const result = await request("/api/submissions/verify/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, directory, requestId, code: String(new FormData(codeForm).get("code") || "") }) });
      if (!result.token) throw new Error("Verification couldn’t finish. Please request a new code.");
      token = result.token; reverify.hidden = true; step("details"); showMessage("");
    });
  });
  function restart() { token = ""; requestId = ""; step("email"); showMessage(""); }
  app.querySelector("[data-restart]")!.addEventListener("click", restart);
  reverify.addEventListener("click", restart);
  details.addEventListener("submit", (event) => {
    event.preventDefault();
    if (directory === "festivals" || directory === "events") {
      const start = details.querySelector<HTMLInputElement>('[name="starts_on"]')!;
      const end = details.querySelector<HTMLInputElement>('[name="ends_on"]')!;
      if (!start.value || (end.value && end.value < start.value)) {
        showMessage("Enter a start date and an end date on or after it.", true);
        (start.value ? end : start).focus();
        return;
      }
    }
    if (!token) { reverify.hidden = false; showMessage("Please verify your email again. Your details will be kept.", true); return; }
    void run(details, async () => {
      const body = new FormData(details);
      if (correction) { body.set("request_type", "correction"); body.set("target_slug", correction.slug); }
      const result = await request(`/api/directory-submissions/${directory}/`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
      if (!result.reference) throw new Error("We couldn’t confirm receipt. Try again; we won’t create a duplicate.");
      details.hidden = true; token = ""; showMessage("");
      const success = app.querySelector<HTMLElement>("[data-success]")!;
      app.querySelector<HTMLElement>("[data-reference]")!.textContent = result.reference;
      success.hidden = false; success.focus();
      app.querySelector(".submission-steps")?.remove();
      track(correction ? "profile_correction_sent" : "directory_submission_sent", { directory });
    });
  });
}
