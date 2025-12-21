(function () {
    const SUBJECT_BASES = {
        '생활과 과학': ['생과', '생활과 과학', '생활과과학'],
        '생명과학': ['생명', '생명과학'],
        '물리학': ['물', '물리', '물리학'],
        '화학': ['화', '화학'],
        '지구과학': ['지', '지구', '지구과학'],
        '과학탐구실험': ['실험', '탐구', '과탐', '과학탐구실험', '과탐실'],
        '융합과학': ['융', '융합', '융과', '융합과학'],
        '통합과학': ['통', '통합', '통과', '통합과학']
    };

    const LEVEL_MAP = {
        'I': ['1', 'I', 'Ⅰ', 'ⅰ', '１', 'i'],
        'II': ['2', 'II', 'Ⅱ', 'ⅱ', '２', 'ii']
    };

    const SUBJECT_ALIASES = {};

    // 1. Generate Base Aliases
    for (const [target, aliases] of Object.entries(SUBJECT_BASES)) {
        aliases.forEach(alias => {
            SUBJECT_ALIASES[alias.replace(/\s+/g, '')] = target;
        });
    }

    // 2. Generate Combined Aliases (Base + Level)
    for (const [targetBase, aliases] of Object.entries(SUBJECT_BASES)) {
        // Core sciences, Integrated subjects, and Science Inquiry Experiment get combined with levels
        const needsLevel = ['물리학', '화학', '생명과학', '지구과학', '통합과학', '과학탐구실험'].includes(targetBase);

        if (needsLevel) {
            for (const [levelTarget, levelAliases] of Object.entries(LEVEL_MAP)) {
                const targetFullName = targetBase + levelTarget;
                aliases.forEach(baseAlias => {
                    levelAliases.forEach(levelAlias => {
                        const combined = (baseAlias + levelAlias).replace(/\s+/g, '');
                        SUBJECT_ALIASES[combined] = targetFullName;
                    });
                });
            }
        }
    }

    // 3. Special Cases (if any)
    // No special cases needed currently as they are handled by dynamic logic

    /**
     * Normalizes a subject name using aliases and removing spaces.
     * @param {string} name 
     * @returns {string}
     */
    function normalizeSubject(name) {
        if (!name) return '';
        const norm = name.toString().trim().replace(/\s+/g, '');
        return SUBJECT_ALIASES[norm] || norm;
    }

    globalThis.App = globalThis.App || {};
    globalThis.App.SubjectAliases = SUBJECT_ALIASES;
    globalThis.App.normalizeSubject = normalizeSubject;
})();
