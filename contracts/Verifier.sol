// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 20491192805390485299153009773594534940189261866228447918068658471970481763042;
    uint256 constant alphay  = 9383485363053290200918347156157836566562967994039712273449902621266178545958;
    uint256 constant betax1  = 4252822878758300859123897981450591353533073413197771768651442665752259397132;
    uint256 constant betax2  = 6375614351688725206403948262868962793625744043794305715222011528459656738731;
    uint256 constant betay1  = 21847035105528745403288232691147584728191162732299865338377159692350059136679;
    uint256 constant betay2  = 10505242626370262277552901082094356697409835680220590971873171140371331206856;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 2408493604041563209170895998011711465349138403841378422521884678100617050415;
    uint256 constant deltax2 = 6876077928635212510195103512558326527628590787879324909470500294370585991184;
    uint256 constant deltay1 = 20176659186644451267183509362018451506537928959214211215511121194422811052609;
    uint256 constant deltay2 = 19335311018314849702270341973085819171380566155075793340926190241722940475937;

    
    uint256 constant IC0x = 15026417925841755537361387405277176768745670130399102003829094173670859850018;
    uint256 constant IC0y = 10103197761858408203358130961220977455499422389970373815313898848790248441524;
    
    uint256 constant IC1x = 4971061321833138704699749156028175946871940983591761662293679185458849289265;
    uint256 constant IC1y = 2551024051565969545393301871855194660019930816650287497794673214807671969759;
    
    uint256 constant IC2x = 17181072100004604379423110100666859161111280650206724444041606724648934393736;
    uint256 constant IC2y = 5990506756893523665978891397643262353796913063327767851139505353952811187219;
    
    uint256 constant IC3x = 20159631484370737750806294613139578004478016290888827960897415829614633381204;
    uint256 constant IC3y = 12240727586343388089421905566627615475607861290695682070701527146201038153011;
    
    uint256 constant IC4x = 21803820231847176201350812230232865968604901234230427361438783108239873314195;
    uint256 constant IC4y = 9154982790453868963125832765182345074337339565804676928615509943969901854411;
    
    uint256 constant IC5x = 18827085980521271741073474866907854082917829824699627464645861626333856748264;
    uint256 constant IC5y = 8765468682685674425168964815232964858607563973847152663781868468765892797140;
    
    uint256 constant IC6x = 6174961287276558376685108458228236780406898710017597208071691730080785963873;
    uint256 constant IC6y = 769673659469597586110400175233150994836302312040291281830243304167299792217;
    
    uint256 constant IC7x = 5256584475766525152621704820598835172811307253054522503991248622260380164996;
    uint256 constant IC7y = 14365588788421580595590194450371560393928238507176513813823630130170481502216;
    
    uint256 constant IC8x = 4371972181255778635087515034197774394153162043454855421338050529603649027305;
    uint256 constant IC8y = 9329470825965661981315625803117890226615643561878381372006049883817773742131;
    
    uint256 constant IC9x = 10863103962832499797058423527006816466046921078177364211322957420161600297028;
    uint256 constant IC9y = 15328791925220694069911553609597293063313914729447532699738689757330188357461;
    
    uint256 constant IC10x = 11791680710939288912150574451082063319480736927548473100023598870820897523809;
    uint256 constant IC10y = 1048987163404799137450265146386689343922359566943211000582679337610537881136;
    
    uint256 constant IC11x = 20834289012847429816238385715917473393050028697530052317269989368576398213230;
    uint256 constant IC11y = 13681473437788183868839317904241730131501419146818289751787403320877710175755;
    
    uint256 constant IC12x = 12342202299071247048842371851813431928493808748308713037701420072830236582668;
    uint256 constant IC12y = 572877005506162304749497828991816085387229212491944621902212643422886108772;
    
    uint256 constant IC13x = 16756328840691787681654654891757628540504791842319280346250632783739387089944;
    uint256 constant IC13y = 2194916021136993760969173390017644119161876597345816189183839432071291221857;
    
    uint256 constant IC14x = 4806179768167662715712384462358421987303193313030537607510468363049379191265;
    uint256 constant IC14y = 14372110389166656203901007678830888239618008040322233328402297837809210495924;
    
    uint256 constant IC15x = 14172340863033041394380141796738405615061264240341258904948341731080965349658;
    uint256 constant IC15y = 11308446722503330269828942461868915194371191996125586495040442406336213693560;
    
    uint256 constant IC16x = 14690099210033466173859839312579460172702203003820709326278802358977638602940;
    uint256 constant IC16y = 5462006200389479984200287091721446005727162770025251780480727917741372726587;
    
    uint256 constant IC17x = 6168145977720555284256050294928076728862816486040663338772031741942473327820;
    uint256 constant IC17y = 11346140335559944133206044892548981472896463881568635168651052569385369267825;
    
    uint256 constant IC18x = 4129208811437864705328369813286392156986138095837454872287805601310158686528;
    uint256 constant IC18y = 1083798215993883795661035123709073669403425378011026633229739736246478480662;
    
    uint256 constant IC19x = 14862087575873163636298230846856576930734996715253798245291285533236826072995;
    uint256 constant IC19y = 6809493430065283797885555217840447937857567645115492538275986625847200028862;
    
    uint256 constant IC20x = 7124881223910531152465005769518177384672136602563669135501091194850274046306;
    uint256 constant IC20y = 11097515889750192632700040921434550613132251806641995190513972596897940562705;
    
    uint256 constant IC21x = 7509627276145454272621088332664053550620545451431797240283585331031657606029;
    uint256 constant IC21y = 5272945801827000566902367568196766137580856652344611100958341923772987924218;
    
    uint256 constant IC22x = 11667340576304094152200431606317588756915261205896843303882902919191749866162;
    uint256 constant IC22y = 4623665442062597987341068002750990589392474376937880377233010142348357927428;
    
    uint256 constant IC23x = 15320722782583143480021837014532046679029330482061935019717904929626962644435;
    uint256 constant IC23y = 8967165117084990346709314188453875943759866574906548273213195618421631697588;
    
    uint256 constant IC24x = 13572876479424674961468402853071595112429057362701440530526919656861997016502;
    uint256 constant IC24y = 16422333879983633452010319702318328059128214121029998643125804397389550529581;
    
    uint256 constant IC25x = 20851428300017723807573372986789191494127008649351155319826852338372486878402;
    uint256 constant IC25y = 16078044206143955049265941399901802592686352489511442365710134925472178227401;
    
    uint256 constant IC26x = 8888809137124617824073069892394280982079062847196250821025742459827773040999;
    uint256 constant IC26y = 20751997669471539149895322037696569166206106975357471185138461364959068611615;
    
    uint256 constant IC27x = 10154200710602004993111354413015946642466236544338764872169537441201171586286;
    uint256 constant IC27y = 16875561844459822734497285493544463770788290340820066633278447478553319370006;
    
    uint256 constant IC28x = 1704614421781833986061478089619948085658790006036102043148976360553886594739;
    uint256 constant IC28y = 1151297208093840126002680635876568296520599199839559634728380281169031312922;
    
    uint256 constant IC29x = 17962730582902983763588674132507288003235070776885492138615981929053783545215;
    uint256 constant IC29y = 10718374122937277935058425622990899635399215205338419640278937202068519192027;
    
    uint256 constant IC30x = 16945836084582240656137159494934429847116817271591698983525874450674282519660;
    uint256 constant IC30y = 3466405129648163756269093548003929312074881085489028701277504321790932264086;
    
    uint256 constant IC31x = 10273318556689187196744811324048938104477805508083313879350678066172314968486;
    uint256 constant IC31y = 4849057281981388135453407972207239077575435099619145703360520408645474481567;
    
    uint256 constant IC32x = 12890189373951540946330403947302607374291035645268860017504828778878561874429;
    uint256 constant IC32y = 7918488555096916513101805801566978178044278509443791055448476326626963483261;
    
    uint256 constant IC33x = 10075799406280909084657544665933405301993977468275430167276505190955990709363;
    uint256 constant IC33y = 3747131009740882489597018625050061696198894177429643683558269136424503758897;
    
    uint256 constant IC34x = 4562051909378922279772124206375418354130547884633520855069267114473322681645;
    uint256 constant IC34y = 17272667009562002240467700457763596392403058249550773743343046756952257863493;
    
    uint256 constant IC35x = 20477730692049084371830949946160875290659831491974320906054516280435238894767;
    uint256 constant IC35y = 6404785219054027057889759467347927422853940317071356336457798494141547448252;
    
    uint256 constant IC36x = 13432010104798662178446658389787625300845426068345131759422280513166761422373;
    uint256 constant IC36y = 15038774635153708764940323090719468136069736137275545056706309104284269541912;
    
    uint256 constant IC37x = 6674233576151513192649000304370269313958569681369744510340951572787375032036;
    uint256 constant IC37y = 11957883872110036760252589415962962537346570751455295365505542076456426812382;
    
    uint256 constant IC38x = 6012313664435426373523833718654513823623630348435694000346891192308977778945;
    uint256 constant IC38y = 3287218064015579560718335658841612579029506195457164835362101663748183316975;
    
    uint256 constant IC39x = 18136934113448475748388299694543375213781824878328775978822878670215343596138;
    uint256 constant IC39y = 10701196927458557625678870604756039683215813837149944004402193767679647349052;
    
    uint256 constant IC40x = 13758838149747385984653739905909300055056212282918996291788427964863887418430;
    uint256 constant IC40y = 15196042753125633735294783988741532427092601535938924061397536473791071583971;
    
    uint256 constant IC41x = 3571435578158027586258639911407786453985711055029760465559600174405459138933;
    uint256 constant IC41y = 6650625775560710285734993627091044523040498473385503246055962503609349177492;
    
    uint256 constant IC42x = 10234158467254306264552655568185236680604419408608881396052404790616973390147;
    uint256 constant IC42y = 12628564496851113964586587712433208492601743282251589182704346827766313366585;
    
    uint256 constant IC43x = 2131254438750594198796987804841311939529152523112078808632920551546061181402;
    uint256 constant IC43y = 12653746953406821637540985729862880868807183548146120400842745917219657948624;
    
    uint256 constant IC44x = 16401009817781505914560047189733690439251445744950183657972640415903103249335;
    uint256 constant IC44y = 2279828235704438962867642722649019714194750885298787281253599489835274045041;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[44] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                
                g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))
                
                g1_mulAccC(_pVk, IC17x, IC17y, calldataload(add(pubSignals, 512)))
                
                g1_mulAccC(_pVk, IC18x, IC18y, calldataload(add(pubSignals, 544)))
                
                g1_mulAccC(_pVk, IC19x, IC19y, calldataload(add(pubSignals, 576)))
                
                g1_mulAccC(_pVk, IC20x, IC20y, calldataload(add(pubSignals, 608)))
                
                g1_mulAccC(_pVk, IC21x, IC21y, calldataload(add(pubSignals, 640)))
                
                g1_mulAccC(_pVk, IC22x, IC22y, calldataload(add(pubSignals, 672)))
                
                g1_mulAccC(_pVk, IC23x, IC23y, calldataload(add(pubSignals, 704)))
                
                g1_mulAccC(_pVk, IC24x, IC24y, calldataload(add(pubSignals, 736)))
                
                g1_mulAccC(_pVk, IC25x, IC25y, calldataload(add(pubSignals, 768)))
                
                g1_mulAccC(_pVk, IC26x, IC26y, calldataload(add(pubSignals, 800)))
                
                g1_mulAccC(_pVk, IC27x, IC27y, calldataload(add(pubSignals, 832)))
                
                g1_mulAccC(_pVk, IC28x, IC28y, calldataload(add(pubSignals, 864)))
                
                g1_mulAccC(_pVk, IC29x, IC29y, calldataload(add(pubSignals, 896)))
                
                g1_mulAccC(_pVk, IC30x, IC30y, calldataload(add(pubSignals, 928)))
                
                g1_mulAccC(_pVk, IC31x, IC31y, calldataload(add(pubSignals, 960)))
                
                g1_mulAccC(_pVk, IC32x, IC32y, calldataload(add(pubSignals, 992)))
                
                g1_mulAccC(_pVk, IC33x, IC33y, calldataload(add(pubSignals, 1024)))
                
                g1_mulAccC(_pVk, IC34x, IC34y, calldataload(add(pubSignals, 1056)))
                
                g1_mulAccC(_pVk, IC35x, IC35y, calldataload(add(pubSignals, 1088)))
                
                g1_mulAccC(_pVk, IC36x, IC36y, calldataload(add(pubSignals, 1120)))
                
                g1_mulAccC(_pVk, IC37x, IC37y, calldataload(add(pubSignals, 1152)))
                
                g1_mulAccC(_pVk, IC38x, IC38y, calldataload(add(pubSignals, 1184)))
                
                g1_mulAccC(_pVk, IC39x, IC39y, calldataload(add(pubSignals, 1216)))
                
                g1_mulAccC(_pVk, IC40x, IC40y, calldataload(add(pubSignals, 1248)))
                
                g1_mulAccC(_pVk, IC41x, IC41y, calldataload(add(pubSignals, 1280)))
                
                g1_mulAccC(_pVk, IC42x, IC42y, calldataload(add(pubSignals, 1312)))
                
                g1_mulAccC(_pVk, IC43x, IC43y, calldataload(add(pubSignals, 1344)))
                
                g1_mulAccC(_pVk, IC44x, IC44y, calldataload(add(pubSignals, 1376)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            
            checkField(calldataload(add(_pubSignals, 480)))
            
            checkField(calldataload(add(_pubSignals, 512)))
            
            checkField(calldataload(add(_pubSignals, 544)))
            
            checkField(calldataload(add(_pubSignals, 576)))
            
            checkField(calldataload(add(_pubSignals, 608)))
            
            checkField(calldataload(add(_pubSignals, 640)))
            
            checkField(calldataload(add(_pubSignals, 672)))
            
            checkField(calldataload(add(_pubSignals, 704)))
            
            checkField(calldataload(add(_pubSignals, 736)))
            
            checkField(calldataload(add(_pubSignals, 768)))
            
            checkField(calldataload(add(_pubSignals, 800)))
            
            checkField(calldataload(add(_pubSignals, 832)))
            
            checkField(calldataload(add(_pubSignals, 864)))
            
            checkField(calldataload(add(_pubSignals, 896)))
            
            checkField(calldataload(add(_pubSignals, 928)))
            
            checkField(calldataload(add(_pubSignals, 960)))
            
            checkField(calldataload(add(_pubSignals, 992)))
            
            checkField(calldataload(add(_pubSignals, 1024)))
            
            checkField(calldataload(add(_pubSignals, 1056)))
            
            checkField(calldataload(add(_pubSignals, 1088)))
            
            checkField(calldataload(add(_pubSignals, 1120)))
            
            checkField(calldataload(add(_pubSignals, 1152)))
            
            checkField(calldataload(add(_pubSignals, 1184)))
            
            checkField(calldataload(add(_pubSignals, 1216)))
            
            checkField(calldataload(add(_pubSignals, 1248)))
            
            checkField(calldataload(add(_pubSignals, 1280)))
            
            checkField(calldataload(add(_pubSignals, 1312)))
            
            checkField(calldataload(add(_pubSignals, 1344)))
            
            checkField(calldataload(add(_pubSignals, 1376)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
