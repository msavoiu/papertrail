// FOR REFERENCEG

const responseFormat = {
    type: "object",
    properties: {
        missing_information: {
            type: "array",
            description: "Documents or personal details that the user has not yet provided but are required for the request.",
            items: {
                type: "string",
                examples: ["Date of birth", "Social Security Number", "Proof of address"]
            }
        },
        acquired_information: {
            type: "array",
            description: "Documents or personal details that the user has confirmed they already have or uploaded.",
            items: {
                type: "string",
                examples: ["Driver's license", "Birth certificate scan"]
            }
        },
        organization: {
            type: "string",
            description: "The organization or agency responsible for processing the replacement request.",
            examples: ["Department of Motor Vehicles", "Vital Records Office"]
        },
        expected_turnaround: {
            type: "string",
            description: "An estimated timeframe for how long the replacement process usually takes.",
            examples: ["2-4 weeks", "5-10 business days"]
        },
        next_steps: {
            type: "string",
            description: "Step-by-step instructions for how the user can proceed with the document replacement request.",
            examples: [
                "Visit the official DMV website, complete the online replacement form, and submit the required documents. You may also visit your nearest DMV branch in person if online submission is unavailable."
            ]
        }
    },
    required: [
        missing_information,
        acquired_information,
        organization,
        expected_turnaround,
        next_steps
    ]
};
