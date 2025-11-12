# 🧾 PaperTrail

**Secure, guided document recovery for individuals experiencing homelessness.**

---

## 🌟 Inspiration

We were inspired by the critical barrier that lost, stolen, or inaccessible documents create for people experiencing homelessness.  
The inability to prove one’s identity immediately blocks access to shelter, employment, benefits, and housing programs.  

Our goal with **PaperTrail** is to digitize and streamline the complex document recovery process — turning a bureaucratic hurdle into a clear pathway to stability.

---

## 💡 What It Does

**PaperTrail** is a secure, guided workflow application that dramatically accelerates document recovery for individuals experiencing homelessness.

### Key Features

- **🧭 Guided Request & PII Status**  
  Users input their Personally Identifiable Information (PII) once.  
  The app then generates a **Summary PDF** detailing exactly what PII is missing for any specific application.  
  This process is powered by our **Letta chatbot**, which guides user input and runs backend logic to identify information gaps.

- **💸 Fee Waiver Integration**  
  Integrates the process for obtaining **state-mandated fee-exempt documents** (e.g., CA Birth Certificate/ID) by facilitating the signing of the **Affidavit of Homeless Status** with verified partners.

- **🔐 Secure Partner Sharing**  
  Users can grant **one-click consent** to securely share their PII and verified records with a trusted case manager — instantly mobilizing social service support.

- **📁 Digital Vault & Access**  
  A **secure Vault Page** to store and access digital copies of documents, allowing users to preview and download them to prove possession on demand.

---

## 🏗️ How We Built It

We focused on building a **secure, user-centric mobile application** using modern development practices.

### Front-End
- Built with **React Native (Expo)** for rapid mobile development.
- Designed a **Home Page** for easy request initiation and a **Vault Page** for secure access.

### Back-End & Logic
- Created a workflow engine where the **Letta chatbot** serves as the intelligent backend logic layer.
- Guides user interaction, collects required PII, and determines document application status and next steps.

### Data Structure
- Database tracks **PII completeness** across **12 target documents**, enabling the Missing PII Summary feature.

### Security
- Enforced **PII masking**, **re-authentication** for editing sensitive data (SSN, Address), and **encrypted storage** for the Digital Vault.

---

## ⚙️ Challenges We Ran Into

- **Firebase & Expo Conflict**  
  Integrating backend services with Firebase in the constrained React Native Expo environment caused compatibility issues, leading us to design alternative auth and data solutions.

- **External Form Specificity**  
  Mapping user-provided PII accurately across official documents (e.g., CA Birth Certificate vs. SSA SS-5) required meticulous manual logic to ensure legal compliance.

- **Modeling Partner Policy**  
  Designing workflows around legal protocols like **Affidavit of Homeless Status** signatures and **Agency MOU requirements** posed complex architectural and non-code challenges.

---

## 🏆 Accomplishments We’re Proud Of

- **Fee Waiver Workflow**  
  Successfully modeled the **end-to-end process** for securing a **fee-exempt California Birth Certificate**, a crucial first step in the recovery process.

- **Letta-Powered Logic**  
  Leveraged the **Letta chatbot agent** as the intelligent backend — transforming raw PII into actionable insights and guiding users through recovery.

- **Strong Security Posture**  
  Implemented robust **authentication**, **encryption**, and **access control** — essential for safeguarding vulnerable users’ data.

---

## 📚 What We Learned

We learned that in **social impact technology**, the real challenge isn’t technological innovation — it’s **digitizing complex policy and regulatory workflows**.  

The biggest barriers are not paper forms themselves, but the **sequencing, cost, and logistics of compliance** — all of which a thoughtful application can streamline.

---

## 🚀 What’s Next for PaperTrail

- **🤝 Pilot Program Launch**  
  Partner with local service providers to pilot **One-Click Consent Sharing** with case managers.

- **🔗 API Integration for Status**  
  Develop APIs to connect with partner systems (e.g., **HMIS**) and automatically update a document’s status from “Submitted” → “Arrived”.

- **🌎 Expanding State Coverage**  
  Extend platform intelligence beyond California to incorporate **fee waiver laws** and **document protocols** in neighboring states.

---

## 🧠 Built With

- **React Native (Expo)**
- **Letta AI Chatbot**
- **Custom Backend Workflow Engine**
- **Encrypted Storage**
- **Secure Authentication Protocols**

---

## ❤️ Team PaperTrail

A mission-driven project dedicated to restoring identity, access, and dignity through technology.
