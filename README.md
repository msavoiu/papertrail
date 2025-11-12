# PaperTrail

[![Devpost video](http://img.youtube.com/vi/A3x4ZLDtCKY/maxresdefault.jpg)](https://www.youtube.com/watch?v=A3x4ZLDtCKY)

## Inspiration

We were inspired by the critical barrier that lost, stolen, or inaccessible documents create for people experiencing homelessness. The inability to prove one's identity immediately blocks access to shelter, employment, benefits, and housing programs. Our goal was to digitize and streamline the complex document recovery process, turning a bureaucratic hurdle into a clear pathway to stability.

## What it does

PaperTrail is a secure, guided workflow application that dramatically accelerates document recovery for individuals experiencing homelessness.

### Guided Request & PII Status
Users input PII once. The app then generates a Summary PDF detailing exactly what PII is still missing for any specific application. This process is powered by our Letta chatbot, which guides user input and executes backend logic to determine information gaps.

### Fee Waiver Integration
We integrate the process for receiving state-mandated fee-exempt documents (CA Birth Certificate/ID) by facilitating the signing of the Affidavit of Homeless Status with verified partners.

### Secure Partner Sharing
The app allows users to grant one-click consent to securely share their PII and verified records with a trusted case manager, instantly mobilizing social service support.

### Digital Vault & Access
Provides a secure Vault Page to store digital copies, allowing users to preview and download their documents to prove possession on demand.

## How we built it

[![My Skills](https://skillicons.dev/icons?i=js,react,aws,firebase)](https://skillicons.dev)

We focused on building a secure, user-centric application utilizing modern mobile development practices:

### Front-End
Developed the mobile application using React Native Expo for rapid development, focusing on the Home Page for easy request initiation and the Vault Page for secure access.

### Back-End/Logic
Built a workflow engine where the Letta chatbot agent serves as the core logic layer, guiding user interaction, collecting necessary PII, and running checks to determine document application status and required next steps.

### Data Structure
Structured our database to track PII completeness status for all 12 target documents, enabling the Missing PII Summary feature.

### Security
Implemented security protocols including PII masking and re-authentication for editing sensitive data (SSN, Address) and encrypted storage for the Digital Vault.

## Challenges we ran into

### Firebase & Expo Conflict
A primary technical challenge was overcoming compatibility issues when attempting to integrate our backend services with Firebase while using the constrained React Native Expo environment, which forced us to find alternative authentication and data solutions.

### External Form Specificity
Mapping user input PII accurately across different official documents (like the CA Birth Certificate application vs. the SSA SS-5 form) required painstaking manual logic to ensure the generated Summary PDF was legally viable.

### Modeling Partner Policy
Architecting the app's workflow around complex legal and partnership protocols (like the Affidavit of Homeless Status signature process and the necessary Agency MOU requirements) was a significant non-code challenge.

## Accomplishments that we're proud of

### The Fee Waiver Workflow
Successfully modeling the end-to-end process for securing a fee-exempt California Birth Certificate, which is the critical first step to getting all other documents.

### Letta-Powered Logic
Successfully leveraging our Letta chatbot agent to serve as the intelligent backend, transforming raw user PII into actionable application statuses and guiding the user's document recovery journey.

### Strong Security Posture
Implementing robust authentication and encryption protocols, including PII masking and access controls, which is paramount when handling data for vulnerable populations.

## What we learned

We learned that for social impact technology, the solution lies less in innovative technology and more in digitizing complex policy and regulatory workflows. The biggest barriers for users are not paper forms themselves, but the sequencing, cost, and logistics of compliance—all of which a thoughtful application can solve.

## What's next for PaperTrail

### Pilot Program Launch
Partnering with local service providers to pilot the app's One-Click Consent Sharing feature with a small cohort of case managers.

### API Integration for Status
Develop an API to integrate with partner systems (e.g., Homeless Management Information Systems - HMIS) to automatically update a document's status from "Submitted" to "Arrived."

### Expanding State Coverage
Extend the platform's intelligence beyond California to incorporate fee waiver laws and document protocols for neighboring states.
