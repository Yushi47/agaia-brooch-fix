module.exports = function BroochCdFix(mod) {
    const BROOCHES = [291060, 291061, 291062, 291063, 291064, 291065, 291066, 291067, 293007, 293008, 296137, 296124];
    const BROOCH_SKILL_ID = 98150023;
    const BROOCH_COOLDOWN = 180000;
    const BROOCH_CD_DEBUFF = 301807;
    const BROOCH_SLOT = '20';
    const RESET_BUFFS = [303401008, 45000116];

    mod.game.initialize('inventory');
    mod.game.initialize('me');

    const DEBUG = false;
    const log = (...args) => { if (DEBUG) mod.log('[BroochFix]', ...args); };

    let timer = null;

    function getEquippedBrooch() {
        const slot = mod.game.inventory.equipment.slots[BROOCH_SLOT];
        return slot ? slot.id : null;
    }

    function isNewBrooch(id) {
        return id && BROOCHES.includes(id);
    }

    function setSkillCooldown(duration) {
        log('Setting skill cooldown:', duration);
        mod.send('S_START_COOLTIME_SKILL', 3, {
            skill: { reserved: 0, npc: false, type: 1, huntingZoneId: 0, id: BROOCH_SKILL_ID },
            cooldown: duration
        });
    }

    function setItemCooldown(duration) {
        const id = getEquippedBrooch();
        if (isNewBrooch(id)) {
            log('Setting item cooldown:', duration, 'for item ID:', id);
            mod.send('S_START_COOLTIME_ITEM', 1, {
                item: id,
                cooldown: Math.floor(duration / 1000)
            });
        }
    }

    function clearTimer() {
        if (timer) {
            mod.clearTimeout(timer);
            timer = null;
            log('Cleared existing cooldown timer');
        }
    }

    function resetCooldowns() {
        log('Resetting all cooldowns to 0');
        setSkillCooldown(0);
        setItemCooldown(0);
    }

    function useBrooch() {
        const id = getEquippedBrooch();
        if (!mod.game.me || !mod.game.me.loc || !isNewBrooch(id)) {
            log('useBrooch() failed: missing location or invalid brooch');
            return;
        }

        log('Simulating brooch use for item ID:', id);
        mod.send('C_USE_ITEM', 3, {
            gameId: mod.game.me.gameId,
            id,
            amount: 1,
            loc: mod.game.me.loc,
            w: mod.game.me.loc.w,
            unk4: true
        });
    }

    mod.hook('S_ABNORMALITY_BEGIN', 4, { order: -999999 }, e => {
        if (!mod.game.me.is(e.target)) return;

        if (e.id === BROOCH_CD_DEBUFF) {
            const duration = Number(e.duration);
            log('Brooch CD debuff started. Duration:', duration);
            setSkillCooldown(duration);
            clearTimer();
            setItemCooldown(duration); // NO delay
        }

        if (RESET_BUFFS.includes(e.id)) {
            log('Reset buff detected:', e.id);
            clearTimer();
            resetCooldowns();
        }
    });

    mod.hook('S_ABNORMALITY_END', 1, { order: -999999 }, e => {
        if (!mod.game.me.is(e.target)) return;
        if (e.id === BROOCH_CD_DEBUFF) {
            log('Brooch CD debuff ended');
            clearTimer();
            resetCooldowns();
        }
    });

    mod.hook('S_START_COOLTIME_ITEM', 1, e => {
        if (isNewBrooch(e.item)) {
            log('Intercepted item cooldown:', e.cooldown, '→ Overriding with', BROOCH_COOLDOWN);
            setSkillCooldown(BROOCH_COOLDOWN);
            e.cooldown = BROOCH_COOLDOWN / 1000;
            return true;
        }
    });

    mod.hook('S_START_COOLTIME_SKILL', 3, e => {
        if (!e.skill) return;
        if (e.skill.id === BROOCH_SKILL_ID) {
            if (e.cooldown > 156000) {
                log('Intercepted excessive skill cooldown:', e.cooldown, '→ Reset to', BROOCH_COOLDOWN);
                e.cooldown = BROOCH_COOLDOWN;
                return true;
            }
            if (e.cooldown === 0) {
                log('Skill cooldown reset by server → syncing item cooldown');
                setItemCooldown(0);
            }
        }
    });

    mod.hook('C_NOTIMELINE_SKILL', 3, e => {
        if (!e.skill) return;
        if (e.skill.id === BROOCH_SKILL_ID) {
            log('Brooch skill manually activated → triggering simulated use');
            useBrooch();
            return false;
        }
    });

    this.destructor = () => {
        clearTimer();
        log('Destructor called — timer cleared');
    };
};
