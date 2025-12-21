(function () {
    const SUBJECT_CONFIG = {
        BASES: {
            '생활과 과학': { aliases: ['생과', '생활과 과학', '생활과과학'], grades: [3] },
            '생명과학': { aliases: ['생명', '생명과학'], level_grades: { 'I': 2, 'II': 3 } },
            '물리학': { aliases: ['물리', '물', '물리학'], level_grades: { 'I': 2, 'II': 3 } },
            '화학': { aliases: ['화학', '화'], level_grades: { 'I': 2, 'II': 3 } },
            '지구과학': { aliases: ['지구', '지', '지구과학'], level_grades: { 'I': 2, 'II': 3 } },
            '과학탐구실험': { aliases: ['과탐', '탐구', '실험', '과학탐구실험', '과탐실'], grades: [1] },
            '융합과학': { aliases: ['융과', '융합', '융', '융합과학'], grades: [3] },
            '통합과학': { aliases: ['통과', '통합', '통', '통합과학'], grades: [1] }
        },
        LEVELS: {
            'I': ['1', 'I', 'Ⅰ', 'ⅰ', '１', 'i'],
            'II': ['2', 'II', 'Ⅱ', 'ⅱ', '２', 'ii']
        }
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.SubjectConfig = SUBJECT_CONFIG;
})();
