'use strict';

const apiUtils = {
    /**
     * Calculates standardized API pagination metadata based on total items.
     *
     * @param {any[]} items        - The sliced data chunk for the current page
     * @param {number} totalItems  - Total database items count
     * @param {number} page        - Selected page (> 0)
     * @param {number} limit       - Max items per page (> 0)
     * @returns {object} Standard paginated JSON response envelope
     */
    paginate(items, totalItems, page = 1, limit = 10) {
        if (page < 1) page = 1;
        if (limit < 1) limit = 1;

        const totalPages = Math.ceil(totalItems / limit);

        return {
            data: items,
            metadata: {
                totalElements: totalItems,
                totalPages: totalPages,
                currentPage: page,
                limit: limit,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        };
    }
};

module.exports = apiUtils;
