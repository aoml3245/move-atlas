import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from catalog import canonical,infer_gear

class DedupSafety(unittest.TestCase):
 def test_aliases_merge_but_grip_angle_and_limb_variations_survive(self):
  eq=['dumbbell']
  self.assertEqual(canonical('Standing Dumbbell Biceps Curls',eq),canonical('Dumbbell Curl',eq))
  self.assertEqual(canonical('Single Arm Dumbbell Row',eq),canonical('Dumbbell One-Arm Row',eq))
  self.assertNotEqual(canonical('Incline Bench Press',['barbell','bench']),canonical('Decline Bench Press',['barbell','bench']))
  self.assertNotEqual(canonical('Wide Grip Bench Press',['barbell','bench']),canonical('Close Grip Bench Press',['barbell','bench']))
  self.assertNotEqual(canonical('One Arm Dumbbell Row',eq),canonical('Dumbbell Row',eq))
  self.assertNotEqual(canonical('Romanian Deadlift',['barbell']),canonical('Stiff Leg Deadlift',['barbell']))
  self.assertNotEqual(canonical('Reverse Nordic Curl',[]),canonical('Nordic Curl',[]))
  self.assertNotEqual(canonical('Reverse Grip Curl',eq),canonical('Palm Up Curl',eq))
 def test_gender_illustrations_merge_numbered_variants_do_not(self):
  self.assertEqual(canonical('Push-Up (male)',[]),canonical('Push-Up (female)',[]))
  self.assertNotEqual(canonical('Jump Squat v. 2',[]),canonical('Jump Squat',[]))
 def test_tools_include_necessary_furniture_and_support(self):
  gear,_=infer_gear('Dumbbell Bench Press',['dumbbell'],'strength','bench_press')
  self.assertEqual(gear,['bench','dumbbell'])
  gear,_=infer_gear('Pull-Up',['body weight'],'strength','pullup')
  self.assertEqual(gear,['pullup_bar'])
  gear,_=infer_gear('Dumbbell Floor Press',['dumbbell'],'strength','bench_press')
  self.assertEqual(gear,['dumbbell'])
  gear,_=infer_gear('EZ Barbell Curl',['ez barbell'],'strength','curl')
  self.assertEqual(gear,['ez_bar'])
  gear,_=infer_gear('Dumbbell Incline Hammer Press',['dumbbell'],'strength','bench_press')
  self.assertEqual(gear,['bench','dumbbell'])
  gear,_=infer_gear('Muscle Up',['bodyweight'],'strength','other')
  self.assertEqual(gear,['pullup_bar'])
  gear,_=infer_gear('Ring Dips',['bodyweight'],'strength','dip')
  self.assertEqual(gear,['suspension'])
  gear,_=infer_gear('One-Arm Dumbbell Row',['dumbbell'],'strength','row','Choose a flat bench and place a dumbbell on each side of it. Place a knee on the bench.')
  self.assertEqual(gear,['bench','dumbbell'])
  gear,_=infer_gear('Glute Bridge',[],'strength','hip','Lie on your back with your feet on the ground. Raise your hips. You can add weight or put feet on a bench.')
  self.assertEqual(gear,[])
  gear,_=infer_gear('Dumbbell One-Arm Shoulder Press',['dumbbell'],'strength','shoulder_press','Sit on a bench or stand with your back straight. Hold one dumbbell.')
  self.assertEqual(gear,['dumbbell'])
 def test_anatomical_band_and_back_lever_are_not_equipment(self):
  gear,_=infer_gear('Standing IT Band Stretch',[],'stretching','stretch')
  self.assertNotIn('band',gear)
  gear,_=infer_gear('Back Lever',['none (bodyweight exercise)','Pull-up bar'],'strength','other')
  self.assertNotIn('machine',gear)

if __name__=='__main__':unittest.main()
