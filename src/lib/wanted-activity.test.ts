import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WantedActivityClock, weightedPlayMinutes } from './wanted-activity.ts'
test('one trusted interaction unlocks the multiplier for the whole completed session', () => {
 const clock = new WantedActivityClock()
 clock.interact(true)
 for (let i=0;i<24;i++) clock.tick(5000)
 assert.equal(clock.activeMinutes(2),2)
 assert.equal(weightedPlayMinutes(2,clock.activeMinutes(2),10),20)
 clock.interact(false)
 for (let i=0;i<12;i++) clock.tick(5000)
 assert.equal(clock.activeMinutes(3),3)
 clock.interact(true)
 assert.equal(clock.activeMinutes(3),3)
})
test('missing or invalid activity receives base time and counts are capped', () => {
 assert.equal(weightedPlayMinutes(5,undefined,200),5)
 assert.equal(weightedPlayMinutes(5,Infinity,200),5)
 assert.equal(weightedPlayMinutes(5,-1,200),5)
 assert.equal(weightedPlayMinutes(5,99,10),50)
 assert.equal(weightedPlayMinutes(5,2,1),5)
})
